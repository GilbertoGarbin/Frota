// Testa as migrations num Postgres embutido (PGlite), sem precisar do Supabase.
// Rodar: npm run test:db
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';

const pastaMigrations = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

// O que o Supabase já traz pronto e as migrations esperam encontrar
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;

  create schema storage;
  create table storage.buckets (
    id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text, name text
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  grant usage on schema storage to authenticated;
  grant all on storage.objects to authenticated;
`;

const db = new PGlite();
await db.exec(SUPABASE_STUB);
for (const arquivo of readdirSync(pastaMigrations).filter((f) => f.endsWith('.sql')).sort()) {
  try {
    await db.exec(readFileSync(join(pastaMigrations, arquivo), 'utf8'));
  } catch (e) {
    throw new Error(`Migration ${arquivo} falhou: ${e.message}`);
  }
}

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const um = async (sql, params = []) => (await q(sql, params))[0];

// Executa fn como um usuário logado (papel authenticated + auth.uid())
async function como(uid, fn, papel = 'authenticated') {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']);
  await db.exec(`set role ${papel}`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

const uuid = async () => (await um('select gen_random_uuid() as id')).id;

// --- Cenário base -----------------------------------------------------------
const gestorA = await uuid();
const gestorB = await uuid();
const loginM1 = await uuid();
const loginM2 = await uuid();
for (const id of [gestorA, gestorB, loginM1, loginM2]) {
  await db.query('insert into auth.users (id) values ($1)', [id]);
}

const tenantA = await como(gestorA, async () => (await um(`select criar_tenant('Transportes A') as id`)).id);
const tenantB = await como(gestorB, async () => (await um(`select criar_tenant('Transportes B') as id`)).id);

const novoVeiculo = (placa) =>
  como(gestorA, async () =>
    (await um(
      `insert into veiculos (placa, modelo, consumo_medio_informado) values ($1, 'Scania R450', 2.5) returning id`,
      [placa],
    )).id,
  );
const novoMotorista = (nome, cpf, veiculo) =>
  como(gestorA, async () =>
    (await um(
      `insert into motoristas (nome, cpf, veiculo_vinculado_id, comissao_percentual) values ($1, $2, $3, 10) returning id`,
      [nome, cpf, veiculo],
    )).id,
  );

const v1 = await novoVeiculo('AAA1A11');
const v2 = await novoVeiculo('BBB2B22');
const v3 = await novoVeiculo('CCC3C33');
const m1 = await novoMotorista('João', '11111111111', v1);
const m2 = await novoMotorista('Pedro', '22222222222', v2);

// Ativação do aparelho (será uma Edge Function com service_role): aqui direto, como dono do banco
await db.query(
  `insert into usuarios (id, tenant_id, papel, motorista_id) values ($1, $3, 'motorista', $4), ($2, $3, 'motorista', $5)`,
  [loginM1, loginM2, tenantA, m1, m2],
);

const viagemGestor = (id) => como(gestorA, () => um('select * from viagens where id = $1', [id]));
const viagemMotorista = (login, id) =>
  como(login, () => um('select * from viagens_do_motorista() where id = $1', [id]));
const programar = (motorista, veiculo, frete, adiantamento = 0) =>
  como(gestorA, async () =>
    (await um(
      `insert into viagens (motorista_id, veiculo_id, origem, destino, valor_frete, valor_adiantamento)
       values ($1, $2, 'Curitiba', 'Pato Branco', $3, $4) returning id`,
      [motorista, veiculo, frete, adiantamento],
    )).id,
  );
const anexarCanhoto = (login, viagem) =>
  como(login, () =>
    db.query(`insert into documentos (viagem_id, tipo, arquivo_path) values ($1, 'canhoto', 'x.jpg')`, [viagem]),
  );
// Viagem já finalizada, lançada direto pelo gestor
const viagemFinalizada = (motorista, veiculo, kmIni, kmFim) =>
  como(gestorA, async () =>
    (await um(
      `insert into viagens (motorista_id, veiculo_id, origem, destino, valor_frete, status, km_inicial, km_final)
       values ($1, $2, 'A', 'B', 1000, 'finalizada', $3, $4) returning id`,
      [motorista, veiculo, kmIni, kmFim],
    )).id,
  );
const abastecer = (veiculo, km, litros, preco, cheio, combustivel = 'diesel_s10') =>
  como(gestorA, () =>
    db.query(
      `insert into abastecimentos (veiculo_id, km, litros, preco_litro, tanque_cheio, forma_pagamento, combustivel)
       values ($1, $2, $3, $4, $5, 'cartao_empresa', $6)`,
      [veiculo, km, litros, preco, cheio, combustivel],
    ),
  );

let t1;
let t2;

// --- Testes -----------------------------------------------------------------

test('criar_tenant vincula o gestor e não deixa repetir', async () => {
  assert.notEqual(tenantA, tenantB);
  await assert.rejects(como(gestorA, () => q(`select criar_tenant('Outra')`)), /já pertence/);
});

test('viagem do motorista: totais, comissão e adiantamento em tempo real', async () => {
  await abastecer(v1, 1000, 200, 6, true); // âncora: primeiro tanque cheio
  t1 = await programar(m1, v1, 2000, 500);

  await como(loginM1, async () => {
    await q('select iniciar_viagem($1, 1000)', [t1]);
    await q('select iniciar_viagem($1, 9999)', [t1]); // reenvio da fila: não muda nada
    await q(`insert into despesas (viagem_id, categoria, valor, forma_pagamento) values ($1, 'Alimentação', 100, 'adiantamento')`, [t1]);
    await q(`insert into despesas (viagem_id, categoria, valor, forma_pagamento) values ($1, 'Pedágio', 50, 'proprio_bolso')`, [t1]);
    await q(`insert into complementos (viagem_id, valor, cliente_carga_adicional) values ($1, 800, 'Cliente X')`, [t1]);
  });

  const v = await viagemMotorista(loginM1, t1);
  assert.equal(v.status, 'em_andamento');
  assert.equal(Number(v.km_inicial), 1000);
  assert.equal(Number(v.valor_frete_total), 2800);
  assert.equal(Number(v.comissao_valor), 280);
  assert.equal(Number(v.adiantamento_gasto), 100);
  assert.equal(Number(v.adiantamento_saldo), 400);
  assert.ok(!('combustivel_valor' in v), 'motorista não vê combustível');
  assert.ok(!('resultado_operacional' in v), 'motorista não vê a margem');

  const comp = await como(gestorA, () => um('select * from complementos where viagem_id = $1', [t1]));
  assert.equal(comp.origem_lancamento, 'motorista');
  assert.equal(comp.tipo, 'carga_complementar');
  assert.equal(comp.tenant_id, tenantA);
});

test('reenviar o mesmo lançamento (mesmo UUID) não duplica', async () => {
  const id = await uuid();
  const sql = `insert into paradas (id, viagem_id, tipo, local_nome, avaliacao_estrelas)
               values ($1, $2, 'almoco', 'Restaurante do Zé', 4) on conflict (id) do nothing`;
  await como(loginM1, async () => {
    await q(sql, [id, t1]);
    await q(sql, [id, t1]);
  });
  const r = await um('select count(*)::int as n, min(motorista_id::text) as m from paradas where id = $1', [id]);
  assert.equal(r.n, 1);
  assert.equal(r.m, m1);
});

test('finalizar exige canhoto e gera combustível estimado', async () => {
  await assert.rejects(como(loginM1, () => q('select finalizar_viagem($1, 1200)', [t1])), /canhoto/);
  await anexarCanhoto(loginM1, t1);
  await assert.rejects(como(loginM1, () => q('select finalizar_viagem($1, 900)', [t1])), /km final/);
  await como(loginM1, () => q('select finalizar_viagem($1, 1200)', [t1]));
  await como(loginM1, () => q('select finalizar_viagem($1, 5000)', [t1])); // reenvio: ignora

  const v = await viagemGestor(t1);
  assert.equal(v.status, 'finalizada');
  assert.equal(Number(v.km_final), 1200);
  assert.equal(v.combustivel_status, 'estimado');
  assert.equal(Number(v.combustivel_valor), 480); // 200 km ÷ 2,5 km/L × R$ 6,00
  assert.equal(Number(v.total_despesas), 150);
  assert.equal(Number(v.resultado_operacional), 1890); // 2800 − 480 − 150 − 280
  assert.equal(Number((await um('select km_atual from veiculos where id = $1', [v1])).km_atual), 1200);
});

test('tanque cheio no meio de viagem em andamento: rateio aguarda ela finalizar', async () => {
  t2 = await programar(m1, v1, 3000);
  await como(loginM1, async () => {
    await q('select iniciar_viagem($1, 1200)', [t2]);
    await q(`insert into abastecimentos (viagem_id, km, litros, preco_litro, tanque_cheio, forma_pagamento)
             values ($1, 1300, 50, 6.2, false, 'adiantamento')`, [t2]);
    await q(`insert into abastecimentos (viagem_id, km, litros, preco_litro, tanque_cheio, forma_pagamento)
             values ($1, 1500, 100, 6, true, 'cartao_empresa')`, [t2]);
  });

  const j = await um('select * from janelas_consumo where veiculo_id = $1', [v1]);
  assert.equal(Number(j.km_inicio), 1000);
  assert.equal(Number(j.km_fim), 1500);
  assert.equal(Number(j.litros), 150);
  assert.equal(Number(j.custo_total), 910); // 310 + 600
  assert.equal(j.rateada, false);

  assert.equal((await viagemGestor(t1)).combustivel_status, 'estimado');
  const m = await viagemMotorista(loginM1, t2);
  assert.equal(Number(m.adiantamento_gasto), 310);
  assert.equal(Number(m.adiantamento_saldo), -310); // a reembolsar ao motorista
});

test('ao finalizar, o custo real é rateado por km e as viagens viram "apurado"', async () => {
  await anexarCanhoto(loginM1, t2);
  await como(loginM1, () => q('select finalizar_viagem($1, 1500)', [t2]));

  const a = await viagemGestor(t1);
  const b = await viagemGestor(t2);
  assert.equal(a.combustivel_status, 'apurado');
  assert.equal(b.combustivel_status, 'apurado');
  assert.equal(Number(a.combustivel_valor), 364); // 910 × 200/500
  assert.equal(Number(b.combustivel_valor), 546); // 910 × 300/500

  const veic = await um('select * from veiculos where id = $1', [v1]);
  assert.equal(Number(veic.consumo_medio_km_por_litro), 3.33); // 500 km ÷ 150 L
  assert.equal(Number(veic.preco_medio_referencia_combustivel), 6);
  assert.equal(Number(veic.km_atual), 1500);
});

test('mesmos dados em ordem inversa dão o mesmo resultado (sincronização atrasada)', async () => {
  await abastecer(v2, 1500, 100, 6, true);
  const b = await viagemFinalizada(m2, v2, 1200, 1500);
  await abastecer(v2, 1300, 50, 6.2, false);
  const a = await viagemFinalizada(m2, v2, 1000, 1200);
  await abastecer(v2, 1000, 200, 6, true);

  assert.equal(Number((await viagemGestor(a)).combustivel_valor), 364);
  assert.equal(Number((await viagemGestor(b)).combustivel_valor), 546);
  assert.equal((await viagemGestor(a)).combustivel_status, 'apurado');

  // Recalcular de novo não muda nada
  await q('select app.recalcular_combustivel($1)', [v2]);
  assert.equal(Number((await viagemGestor(a)).combustivel_valor), 364);
  assert.equal(Number((await viagemGestor(b)).combustivel_valor), 546);
});

test('viagem que cruza duas janelas: parte apurada + parte estimada', async () => {
  const c = await viagemFinalizada(m2, v2, 1500, 1900);
  await abastecer(v2, 1700, 80, 6, true); // fecha a janela 1500–1700 (R$ 480)

  const v = await viagemGestor(c);
  assert.equal(v.combustivel_status, 'estimado');
  // 480 reais dos 200 km já apurados + 200 km estimados a 3,04 km/L (700 km ÷ 230 L) × R$ 6,00
  assert.equal(Number(v.combustivel_valor), 874.74);

  await abastecer(v2, 1900, 70, 6, true); // fecha a janela 1700–1900 (R$ 420)
  const depois = await viagemGestor(c);
  assert.equal(depois.combustivel_status, 'apurado');
  assert.equal(Number(depois.combustivel_valor), 900);
});

test('rateio fecha nos centavos e Arla entra no custo mas não nos litros', async () => {
  const ids = [
    await viagemFinalizada(m2, v3, 0, 100),
    await viagemFinalizada(m2, v3, 100, 200),
    await viagemFinalizada(m2, v3, 200, 300),
  ];
  await abastecer(v3, 0, 100, 5, true);
  await abastecer(v3, 150, 4, 5, false, 'arla32'); // R$ 20
  await abastecer(v3, 300, 16, 5, true); // R$ 80

  const j = await um('select * from janelas_consumo where veiculo_id = $1', [v3]);
  assert.equal(Number(j.custo_total), 100);
  assert.equal(Number(j.litros), 16);

  const valores = [];
  for (const id of ids) valores.push(Number((await viagemGestor(id)).combustivel_valor));
  assert.deepEqual([...valores].sort(), [33.33, 33.33, 33.34]);
  assert.equal(Math.round(valores.reduce((s, x) => s + x, 0) * 100), 10000);
});

test('consumo ajustado pelo gestor depois do último fechamento passa a valer', async () => {
  await como(gestorA, () => q('update veiculos set consumo_medio_informado = 2.8 where id = $1', [v3]));
  assert.equal(
    Number((await um('select consumo_medio_km_por_litro as c from veiculos where id = $1', [v3])).c),
    2.8,
  );
});

test('adiantamento sugerido pela média da rota', async () => {
  const s = await como(gestorA, () => um(`select * from sugerir_adiantamento(' curitiba ', 'PATO BRANCO')`));
  assert.equal(Number(s.valor), 500);
  assert.equal(s.quantidade, 1);
  const vazio = await como(gestorA, () => um(`select * from sugerir_adiantamento('X', 'Y')`));
  assert.equal(vazio.valor, null);
  assert.equal(vazio.quantidade, 0);
});

test('cliente não consegue forjar campos derivados', async () => {
  await como(gestorA, () =>
    q(`update viagens set comissao_valor = 1, valor_frete_total = 1, combustivel_valor = 1,
       combustivel_status = 'estimado', adiantamento_gasto = 1 where id = $1`, [t1]),
  );
  const v = await viagemGestor(t1);
  assert.equal(Number(v.valor_frete_total), 2800);
  assert.equal(Number(v.comissao_valor), 280);
  assert.equal(Number(v.combustivel_valor), 364);
  assert.equal(v.combustivel_status, 'apurado');
  assert.equal(Number(v.adiantamento_gasto), 100);
});

test('mudar a comissão no cadastro não altera viagem já iniciada', async () => {
  await como(gestorA, () => q('update motoristas set comissao_percentual = 20 where id = $1', [m1]));
  await como(gestorA, () => q(`update viagens set observacoes = 'x' where id = $1`, [t1]));
  assert.equal(Number((await viagemGestor(t1)).comissao_valor), 280);

  const nova = await programar(m1, v1, 1000);
  assert.equal(Number((await viagemGestor(nova)).comissao_valor), 200);
  await como(gestorA, () => q(`update motoristas set modelo_remuneracao = 'assalariado' where id = $1`, [m1]));
  await como(gestorA, () => q(`update viagens set observacoes = 'y' where id = $1`, [nova]));
  assert.equal(Number((await viagemGestor(nova)).comissao_valor), 0);
});

test('isolamento entre tenants', async () => {
  await como(gestorB, async () => {
    assert.equal((await q('select id from viagens')).length, 0);
    assert.equal((await q('select id from veiculos')).length, 0);
    assert.equal((await q('select id from motoristas')).length, 0);
    assert.equal((await q('select id from despesas')).length, 0);
    assert.equal((await q('select id from janelas_consumo')).length, 0);
    assert.equal((await q('select id from tenants')).length, 1);
    await assert.rejects(
      q(`insert into despesas (viagem_id, categoria, valor, forma_pagamento) values ($1, 'X', 10, 'adiantamento')`, [t1]),
    );
    await assert.rejects(
      q(`insert into viagens (tenant_id, motorista_id, veiculo_id, origem, destino) values ($1, $2, $3, 'A', 'B')`, [tenantA, m1, v1]),
    );
    await assert.rejects(q('select iniciar_viagem($1, 10)', [t1]), /não encontrada/);
    const r = await db.query(`update viagens set valor_frete = 0 where id = $1`, [t1]);
    assert.equal(r.affectedRows, 0);
  });
  assert.equal(Number((await viagemGestor(t1)).valor_frete), 2000);
});

test('limites do motorista', async () => {
  const aberta = await programar(m2, v2, 500);
  await como(loginM2, () => q('select iniciar_viagem($1, 1900)', [aberta]));

  await como(loginM1, async () => {
    assert.equal((await q('select id from viagens')).length, 0, 'não lê a tabela viagens');
    assert.equal((await q('select id from janelas_consumo')).length, 0);
    assert.equal((await q('select id from motoristas')).length, 1, 'só o próprio cadastro');
    assert.equal((await q('select * from viagens_do_motorista() where id = $1', [aberta])).length, 0);
    // viagem de outro motorista
    await assert.rejects(
      q(`insert into despesas (viagem_id, categoria, valor, forma_pagamento) values ($1, 'X', 10, 'adiantamento')`, [aberta]),
    );
    await assert.rejects(q('select finalizar_viagem($1, 2000)', [aberta]), /não encontrada/);
    // viagem própria já finalizada
    await assert.rejects(
      q(`insert into despesas (viagem_id, categoria, valor, forma_pagamento) values ($1, 'X', 10, 'adiantamento')`, [t1]),
    );
    assert.ok((await q('select id from despesas where viagem_id = $1', [t1])).length > 0, 'mas ainda lê');
    await assert.rejects(q(`update veiculos set km_atual = 1 where id = $1 returning id`, [v1]).then((r) => {
      if (r.length === 0) throw new Error('sem permissão');
    }));
  });

  // motorista só lança carga complementar
  await como(loginM2, async () => {
    await assert.rejects(
      q(`insert into complementos (viagem_id, valor, tipo, origem_lancamento) values ($1, 10, 'diaria_espera', 'gestor')`, [aberta]),
    );
    await q(`insert into complementos (viagem_id, valor) values ($1, 10)`, [aberta]);
  });
  await como(gestorA, () =>
    q(`insert into complementos (viagem_id, valor, tipo) values ($1, 320, 'diaria_espera')`, [aberta]),
  );
  assert.equal(Number((await viagemGestor(aberta)).valor_frete_total), 830);
});

test('storage: motorista só envia para a própria viagem em andamento', async () => {
  const aberta = (await um(`select id from viagens where motorista_id = $1 and status = 'em_andamento'`, [m2])).id;
  const enviar = (caminho) =>
    q(`insert into storage.objects (bucket_id, name) values ('comprovantes', $1)`, [caminho]);

  await como(loginM2, async () => {
    await enviar(`${tenantA}/${aberta}/foto.jpg`);
    await assert.rejects(enviar(`${tenantB}/${aberta}/foto.jpg`));
    await assert.rejects(enviar(`${tenantA}/${t1}/foto.jpg`));
    await assert.rejects(enviar(`${tenantA}/qualquer/foto.jpg`));
  });
  await como(loginM1, async () => {
    assert.equal((await q('select id from storage.objects')).length, 0);
  });
  await como(gestorB, async () => {
    assert.equal((await q('select id from storage.objects')).length, 0);
  });
  await como(gestorA, async () => {
    assert.equal((await q('select id from storage.objects')).length, 1);
  });
});

test('motorista inativo ou aparelho revogado perde o acesso', async () => {
  await como(gestorA, () => q(`update motoristas set status = 'inativo' where id = $1`, [m1]));
  await como(loginM1, async () => {
    assert.equal((await q('select * from viagens_do_motorista()')).length, 0);
    assert.equal((await q('select id from veiculos')).length, 0);
    assert.equal((await q('select id from despesas')).length, 0);
  });

  await db.query('update usuarios set ativo = false where id = $1', [loginM2]);
  await como(loginM2, async () => {
    assert.equal((await q('select * from viagens_do_motorista()')).length, 0);
    assert.equal((await q('select id from veiculos')).length, 0);
  });
});

test('visitante sem login não acessa nada', async () => {
  await como(null, async () => {
    await assert.rejects(q('select id from viagens'), /permission denied/);
    await assert.rejects(q(`select criar_tenant('X')`), /permission denied/);
  }, 'anon');
});
