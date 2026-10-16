-- Um caminhão fica vinculado a no máximo um motorista ativo da transportadora.
-- Motorista inativo não prende o caminhão (pode ser vinculado a outro).
create unique index motoristas_um_ativo_por_veiculo
  on public.motoristas (tenant_id, veiculo_vinculado_id)
  where status = 'ativo' and veiculo_vinculado_id is not null;
