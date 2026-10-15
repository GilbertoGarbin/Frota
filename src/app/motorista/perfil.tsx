import { useState } from 'react';
import { Text } from 'react-native';

import { Cartao, Dado, EstadoSincronizacao, estilosMotorista as em, TelaMotorista } from '@/components/motorista/base';
import { Aviso } from '@/components/ui/aviso';
import { Botao } from '@/components/ui/botao';
import { useMotorista } from '@/context/MotoristaContext';
import { useSessao } from '@/context/SessaoContext';
import { formatarCpf } from '@/utils/cpf';
import { formatarData, formatarDataHora, formatarDecimal } from '@/utils/formato';

export default function Perfil() {
  const { acesso, sair } = useSessao();
  const { perfil, fila, sincronizando, sincronizar, online } = useMotorista();
  const [confirmando, setConfirmando] = useState(false);
  const m = perfil.motorista;
  const veiculo = perfil.veiculos.find((v) => v.id === m?.veiculo_vinculado_id);

  return (
    <TelaMotorista titulo="Perfil" subtitulo={acesso?.tenantNome}>
      <Cartao>
        <Text style={em.titulo}>{m?.nome ?? acesso?.nome ?? 'Motorista'}</Text>
        {m ? <Dado rotulo="CPF" valor={formatarCpf(m.cpf)} /> : null}
        <Dado rotulo="Veículo" valor={veiculo ? `${veiculo.placa} · ${veiculo.modelo}` : 'Nenhum vinculado'} />
        {m?.cnh_validade ? <Dado rotulo="CNH — validade" valor={formatarData(m.cnh_validade)} /> : null}
        {m ? (
          <Dado
            rotulo="Remuneração"
            valor={
              m.modelo_remuneracao === 'comissionado'
                ? `Comissão de ${formatarDecimal(m.comissao_percentual)}%`
                : 'Salário fixo'
            }
          />
        ) : null}
      </Cartao>

      <Cartao>
        <Text style={em.titulo}>Sincronização</Text>
        <Dado rotulo="Conexão" valor={online ? 'Com internet' : 'Sem sinal'} />
        <Dado rotulo="Envios aguardando" valor={String(fila.length)} />
        <Dado
          rotulo="Última atualização"
          valor={perfil.sincronizado_em ? formatarDataHora(perfil.sincronizado_em) : 'Ainda não sincronizou'}
        />
        <EstadoSincronizacao />
        <Botao titulo="Sincronizar agora" variante="contorno" onPress={sincronizar} carregando={sincronizando} />
      </Cartao>

      {confirmando ? (
        <>
          <Aviso tipo="erro">
            {fila.length > 0
              ? `Atenção: ${fila.length} envio(s) ainda não chegaram ao servidor e serão PERDIDOS. Para voltar, entre de novo com seu CPF e senha.`
              : 'Para voltar, entre de novo com seu CPF e senha.'}
          </Aviso>
          <Botao titulo="Sair da conta" variante="perigo" onPress={sair} />
          <Botao titulo="Cancelar" variante="link" onPress={() => setConfirmando(false)} />
        </>
      ) : (
        <Botao titulo="Sair da conta" variante="link" onPress={() => setConfirmando(true)} />
      )}
    </TelaMotorista>
  );
}
