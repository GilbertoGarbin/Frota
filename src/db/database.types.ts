export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      abastecimentos: {
        Row: {
          atualizado_em: string
          chave_pix: string | null
          combustivel: string
          comprovante_path: string | null
          criado_em: string
          criado_por: string | null
          data: string
          forma_pagamento: string
          id: string
          km: number
          litros: number
          pago_em: string | null
          posto: string | null
          preco_litro: number
          tanque_cheio: boolean
          tenant_id: string
          total: number | null
          veiculo_id: string
          vencimento: string | null
          viagem_id: string | null
        }
        Insert: {
          atualizado_em?: string
          chave_pix?: string | null
          combustivel?: string
          comprovante_path?: string | null
          criado_em?: string
          criado_por?: string | null
          data?: string
          forma_pagamento: string
          id?: string
          km: number
          litros: number
          pago_em?: string | null
          posto?: string | null
          preco_litro: number
          tanque_cheio?: boolean
          tenant_id?: string
          total?: number | null
          veiculo_id: string
          vencimento?: string | null
          viagem_id?: string | null
        }
        Update: {
          atualizado_em?: string
          chave_pix?: string | null
          combustivel?: string
          comprovante_path?: string | null
          criado_em?: string
          criado_por?: string | null
          data?: string
          forma_pagamento?: string
          id?: string
          km?: number
          litros?: number
          pago_em?: string | null
          posto?: string | null
          preco_litro?: number
          tanque_cheio?: boolean
          tenant_id?: string
          total?: number | null
          veiculo_id?: string
          vencimento?: string | null
          viagem_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abastecimentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimentos_tenant_id_veiculo_id_fkey"
            columns: ["tenant_id", "veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "abastecimentos_tenant_id_viagem_id_fkey"
            columns: ["tenant_id", "viagem_id"]
            isOneToOne: false
            referencedRelation: "viagens"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      ativacoes_motorista: {
        Row: {
          codigo_hash: string
          criado_em: string
          expira_em: string
          motorista_id: string
          tenant_id: string
          tentativas: number
        }
        Insert: {
          codigo_hash: string
          criado_em?: string
          expira_em: string
          motorista_id: string
          tenant_id: string
          tentativas?: number
        }
        Update: {
          codigo_hash?: string
          criado_em?: string
          expira_em?: string
          motorista_id?: string
          tenant_id?: string
          tentativas?: number
        }
        Relationships: [
          {
            foreignKeyName: "ativacoes_motorista_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ativacoes_motorista_tenant_id_motorista_id_fkey"
            columns: ["tenant_id", "motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      complementos: {
        Row: {
          atualizado_em: string
          cliente_carga_adicional: string | null
          comprovante_path: string | null
          criado_em: string
          criado_por: string | null
          data: string
          descricao: string | null
          id: string
          local_coleta: string | null
          local_entrega: string | null
          origem_lancamento: string
          peso_volume: string | null
          tenant_id: string
          tipo: string
          valor: number
          viagem_id: string
        }
        Insert: {
          atualizado_em?: string
          cliente_carga_adicional?: string | null
          comprovante_path?: string | null
          criado_em?: string
          criado_por?: string | null
          data?: string
          descricao?: string | null
          id?: string
          local_coleta?: string | null
          local_entrega?: string | null
          origem_lancamento: string
          peso_volume?: string | null
          tenant_id?: string
          tipo: string
          valor: number
          viagem_id: string
        }
        Update: {
          atualizado_em?: string
          cliente_carga_adicional?: string | null
          comprovante_path?: string | null
          criado_em?: string
          criado_por?: string | null
          data?: string
          descricao?: string | null
          id?: string
          local_coleta?: string | null
          local_entrega?: string | null
          origem_lancamento?: string
          peso_volume?: string | null
          tenant_id?: string
          tipo?: string
          valor?: number
          viagem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complementos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complementos_tenant_id_viagem_id_fkey"
            columns: ["tenant_id", "viagem_id"]
            isOneToOne: false
            referencedRelation: "viagens"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      custos_fixos: {
        Row: {
          atualizado_em: string
          categoria: string | null
          criado_em: string
          criado_por: string | null
          descricao: string
          fim: string | null
          id: string
          inicio: string
          tenant_id: string
          valor_mensal: number
          veiculo_id: string | null
        }
        Insert: {
          atualizado_em?: string
          categoria?: string | null
          criado_em?: string
          criado_por?: string | null
          descricao: string
          fim?: string | null
          id?: string
          inicio?: string
          tenant_id?: string
          valor_mensal: number
          veiculo_id?: string | null
        }
        Update: {
          atualizado_em?: string
          categoria?: string | null
          criado_em?: string
          criado_por?: string | null
          descricao?: string
          fim?: string | null
          id?: string
          inicio?: string
          tenant_id?: string
          valor_mensal?: number
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custos_fixos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custos_fixos_tenant_id_veiculo_id_fkey"
            columns: ["tenant_id", "veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      despesas: {
        Row: {
          atualizado_em: string
          categoria: string
          chave_pix: string | null
          comprovante_path: string | null
          criado_em: string
          criado_por: string | null
          data: string
          descricao: string | null
          forma_pagamento: string
          id: string
          local: string | null
          observacoes: string | null
          pago_em: string | null
          tenant_id: string
          valor: number
          vencimento: string | null
          viagem_id: string
        }
        Insert: {
          atualizado_em?: string
          categoria: string
          chave_pix?: string | null
          comprovante_path?: string | null
          criado_em?: string
          criado_por?: string | null
          data?: string
          descricao?: string | null
          forma_pagamento: string
          id?: string
          local?: string | null
          observacoes?: string | null
          pago_em?: string | null
          tenant_id?: string
          valor: number
          vencimento?: string | null
          viagem_id: string
        }
        Update: {
          atualizado_em?: string
          categoria?: string
          chave_pix?: string | null
          comprovante_path?: string | null
          criado_em?: string
          criado_por?: string | null
          data?: string
          descricao?: string | null
          forma_pagamento?: string
          id?: string
          local?: string | null
          observacoes?: string | null
          pago_em?: string | null
          tenant_id?: string
          valor?: number
          vencimento?: string | null
          viagem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "despesas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_tenant_id_viagem_id_fkey"
            columns: ["tenant_id", "viagem_id"]
            isOneToOne: false
            referencedRelation: "viagens"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      documentos: {
        Row: {
          arquivo_path: string
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          enviado_em: string
          id: string
          tenant_id: string
          tipo: string
          viagem_id: string
        }
        Insert: {
          arquivo_path: string
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          enviado_em?: string
          id?: string
          tenant_id?: string
          tipo: string
          viagem_id: string
        }
        Update: {
          arquivo_path?: string
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          enviado_em?: string
          id?: string
          tenant_id?: string
          tipo?: string
          viagem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_tenant_id_viagem_id_fkey"
            columns: ["tenant_id", "viagem_id"]
            isOneToOne: false
            referencedRelation: "viagens"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      janelas_consumo: {
        Row: {
          abastecimento_fechamento_id: string
          consumo_km_por_litro: number
          custo_total: number
          fechada_em: string
          id: string
          km_fim: number
          km_inicio: number
          litros: number
          rateada: boolean
          tenant_id: string
          veiculo_id: string
        }
        Insert: {
          abastecimento_fechamento_id: string
          consumo_km_por_litro: number
          custo_total: number
          fechada_em: string
          id?: string
          km_fim: number
          km_inicio: number
          litros: number
          rateada: boolean
          tenant_id: string
          veiculo_id: string
        }
        Update: {
          abastecimento_fechamento_id?: string
          consumo_km_por_litro?: number
          custo_total?: number
          fechada_em?: string
          id?: string
          km_fim?: number
          km_inicio?: number
          litros?: number
          rateada?: boolean
          tenant_id?: string
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "janelas_consumo_abastecimento_fechamento_id_fkey"
            columns: ["abastecimento_fechamento_id"]
            isOneToOne: true
            referencedRelation: "abastecimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "janelas_consumo_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "janelas_consumo_tenant_id_veiculo_id_fkey"
            columns: ["tenant_id", "veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      manutencoes: {
        Row: {
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          data: string
          descricao: string | null
          id: string
          km: number | null
          km_proxima: number | null
          nota_fiscal_path: string | null
          oficina: string | null
          pago: boolean
          proxima_em_km: number | null
          tenant_id: string
          tipo: string
          valor: number
          veiculo_id: string
          viagem_id: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          data?: string
          descricao?: string | null
          id?: string
          km?: number | null
          km_proxima?: number | null
          nota_fiscal_path?: string | null
          oficina?: string | null
          pago?: boolean
          proxima_em_km?: number | null
          tenant_id?: string
          tipo: string
          valor?: number
          veiculo_id: string
          viagem_id?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          data?: string
          descricao?: string | null
          id?: string
          km?: number | null
          km_proxima?: number | null
          nota_fiscal_path?: string | null
          oficina?: string | null
          pago?: boolean
          proxima_em_km?: number | null
          tenant_id?: string
          tipo?: string
          valor?: number
          veiculo_id?: string
          viagem_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manutencoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manutencoes_tenant_id_veiculo_id_fkey"
            columns: ["tenant_id", "veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "manutencoes_tenant_id_viagem_id_fkey"
            columns: ["tenant_id", "viagem_id"]
            isOneToOne: false
            referencedRelation: "viagens"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      motoristas: {
        Row: {
          atualizado_em: string
          cnh_numero: string | null
          cnh_validade: string | null
          comissao_percentual: number
          cpf: string
          criado_em: string
          id: string
          modelo_remuneracao: string
          nome: string
          salario_fixo: number | null
          status: string
          telefone: string | null
          tenant_id: string
          veiculo_vinculado_id: string | null
        }
        Insert: {
          atualizado_em?: string
          cnh_numero?: string | null
          cnh_validade?: string | null
          comissao_percentual?: number
          cpf: string
          criado_em?: string
          id?: string
          modelo_remuneracao?: string
          nome: string
          salario_fixo?: number | null
          status?: string
          telefone?: string | null
          tenant_id?: string
          veiculo_vinculado_id?: string | null
        }
        Update: {
          atualizado_em?: string
          cnh_numero?: string | null
          cnh_validade?: string | null
          comissao_percentual?: number
          cpf?: string
          criado_em?: string
          id?: string
          modelo_remuneracao?: string
          nome?: string
          salario_fixo?: number | null
          status?: string
          telefone?: string | null
          tenant_id?: string
          veiculo_vinculado_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "motoristas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motoristas_tenant_id_veiculo_vinculado_id_fkey"
            columns: ["tenant_id", "veiculo_vinculado_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      paradas: {
        Row: {
          atualizado_em: string
          avaliacao_estrelas: number | null
          comentario: string | null
          criado_em: string
          criado_por: string | null
          data_hora: string
          id: string
          latitude: number | null
          local_nome: string
          longitude: number | null
          motorista_id: string
          tenant_id: string
          tipo: string
          viagem_id: string
        }
        Insert: {
          atualizado_em?: string
          avaliacao_estrelas?: number | null
          comentario?: string | null
          criado_em?: string
          criado_por?: string | null
          data_hora?: string
          id?: string
          latitude?: number | null
          local_nome: string
          longitude?: number | null
          motorista_id: string
          tenant_id?: string
          tipo: string
          viagem_id: string
        }
        Update: {
          atualizado_em?: string
          avaliacao_estrelas?: number | null
          comentario?: string | null
          criado_em?: string
          criado_por?: string | null
          data_hora?: string
          id?: string
          latitude?: number | null
          local_nome?: string
          longitude?: number | null
          motorista_id?: string
          tenant_id?: string
          tipo?: string
          viagem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paradas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paradas_tenant_id_motorista_id_fkey"
            columns: ["tenant_id", "motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "paradas_tenant_id_viagem_id_fkey"
            columns: ["tenant_id", "viagem_id"]
            isOneToOne: false
            referencedRelation: "viagens"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      plataforma_admins: {
        Row: {
          criado_em: string
          primeiro_acesso: boolean
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          primeiro_acesso?: boolean
          usuario_id: string
        }
        Update: {
          criado_em?: string
          primeiro_acesso?: boolean
          usuario_id?: string
        }
        Relationships: []
      }
      pneus: {
        Row: {
          atualizado_em: string
          criado_em: string
          eixo: number
          estado: string
          id: string
          km_instalacao: number | null
          lado: string
          marca: string | null
          observacao: string | null
          posicao: string
          tenant_id: string
          veiculo_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          eixo: number
          estado?: string
          id?: string
          km_instalacao?: number | null
          lado: string
          marca?: string | null
          observacao?: string | null
          posicao?: string
          tenant_id?: string
          veiculo_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          eixo?: number
          estado?: string
          id?: string
          km_instalacao?: number | null
          lado?: string
          marca?: string | null
          observacao?: string | null
          posicao?: string
          tenant_id?: string
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pneus_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pneus_tenant_id_veiculo_id_fkey"
            columns: ["tenant_id", "veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      tenants: {
        Row: {
          assinatura_status: string
          atualizado_em: string
          carencia_dias: number
          criado_em: string
          id: string
          nome: string
          pago_ate: string | null
          trial_expira_em: string | null
        }
        Insert: {
          assinatura_status?: string
          atualizado_em?: string
          carencia_dias?: number
          criado_em?: string
          id?: string
          nome: string
          pago_ate?: string | null
          trial_expira_em?: string | null
        }
        Update: {
          assinatura_status?: string
          atualizado_em?: string
          carencia_dias?: number
          criado_em?: string
          id?: string
          nome?: string
          pago_ate?: string | null
          trial_expira_em?: string | null
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          id: string
          motorista_id: string | null
          nome: string | null
          papel: string
          primeiro_acesso: boolean
          tenant_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id: string
          motorista_id?: string | null
          nome?: string | null
          papel: string
          primeiro_acesso?: boolean
          tenant_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          motorista_id?: string | null
          nome?: string | null
          papel?: string
          primeiro_acesso?: boolean
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_tenant_id_motorista_id_fkey"
            columns: ["tenant_id", "motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      veiculos: {
        Row: {
          atualizado_em: string
          consumo_informado_em: string | null
          consumo_medio_informado: number | null
          consumo_medio_km_por_litro: number | null
          criado_em: string
          id: string
          km_atual: number
          modelo: string
          placa: string
          preco_medio_referencia_combustivel: number | null
          status: string
          tenant_id: string
        }
        Insert: {
          atualizado_em?: string
          consumo_informado_em?: string | null
          consumo_medio_informado?: number | null
          consumo_medio_km_por_litro?: number | null
          criado_em?: string
          id?: string
          km_atual?: number
          modelo: string
          placa: string
          preco_medio_referencia_combustivel?: number | null
          status?: string
          tenant_id?: string
        }
        Update: {
          atualizado_em?: string
          consumo_informado_em?: string | null
          consumo_medio_informado?: number | null
          consumo_medio_km_por_litro?: number | null
          criado_em?: string
          id?: string
          km_atual?: number
          modelo?: string
          placa?: string
          preco_medio_referencia_combustivel?: number | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "veiculos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      viagens: {
        Row: {
          adiantamento_acertado: boolean
          adiantamento_acertado_em: string | null
          adiantamento_gasto: number
          adiantamento_saldo: number | null
          atualizado_em: string
          carga: string | null
          cliente: string | null
          combustivel_status: string | null
          combustivel_valor: number | null
          comissao_percentual: number
          comissao_valor: number
          criado_em: string
          criado_por: string | null
          data_hora_chegada: string | null
          data_prevista: string
          destino: string
          forma_pagamento_frete: string | null
          gasto_proprio_bolso: number
          id: string
          iniciada_em: string | null
          km_final: number | null
          km_inicial: number | null
          local_chegada: string | null
          motorista_id: string
          observacoes: string | null
          observacoes_finais: string | null
          origem: string
          resultado_operacional: number | null
          status: string
          tenant_id: string
          total_despesas: number
          valor_adiantamento: number
          valor_frete: number
          valor_frete_total: number
          veiculo_id: string
        }
        Insert: {
          adiantamento_acertado?: boolean
          adiantamento_acertado_em?: string | null
          adiantamento_gasto?: number
          adiantamento_saldo?: number | null
          atualizado_em?: string
          carga?: string | null
          cliente?: string | null
          combustivel_status?: string | null
          combustivel_valor?: number | null
          comissao_percentual?: number
          comissao_valor?: number
          criado_em?: string
          criado_por?: string | null
          data_hora_chegada?: string | null
          data_prevista?: string
          destino: string
          forma_pagamento_frete?: string | null
          gasto_proprio_bolso?: number
          id?: string
          iniciada_em?: string | null
          km_final?: number | null
          km_inicial?: number | null
          local_chegada?: string | null
          motorista_id: string
          observacoes?: string | null
          observacoes_finais?: string | null
          origem: string
          resultado_operacional?: number | null
          status?: string
          tenant_id?: string
          total_despesas?: number
          valor_adiantamento?: number
          valor_frete?: number
          valor_frete_total?: number
          veiculo_id: string
        }
        Update: {
          adiantamento_acertado?: boolean
          adiantamento_acertado_em?: string | null
          adiantamento_gasto?: number
          adiantamento_saldo?: number | null
          atualizado_em?: string
          carga?: string | null
          cliente?: string | null
          combustivel_status?: string | null
          combustivel_valor?: number | null
          comissao_percentual?: number
          comissao_valor?: number
          criado_em?: string
          criado_por?: string | null
          data_hora_chegada?: string | null
          data_prevista?: string
          destino?: string
          forma_pagamento_frete?: string | null
          gasto_proprio_bolso?: number
          id?: string
          iniciada_em?: string | null
          km_final?: number | null
          km_inicial?: number | null
          local_chegada?: string | null
          motorista_id?: string
          observacoes?: string | null
          observacoes_finais?: string | null
          origem?: string
          resultado_operacional?: number | null
          status?: string
          tenant_id?: string
          total_despesas?: number
          valor_adiantamento?: number
          valor_frete?: number
          valor_frete_total?: number
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viagens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viagens_tenant_id_motorista_id_fkey"
            columns: ["tenant_id", "motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "viagens_tenant_id_veiculo_id_fkey"
            columns: ["tenant_id", "veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      alertas_gestor: {
        Args: never
        Returns: {
          destino: string
          gravidade: string
          mensagem: string
          referencia_id: string
        }[]
      }
      ativar_aparelho: {
        Args: { p_codigo: string; p_cpf: string }
        Returns: boolean
      }
      concluir_primeiro_acesso: { Args: never; Returns: undefined }
      criar_tenant: {
        Args: { p_nome: string; p_nome_usuario?: string }
        Returns: string
      }
      criar_viagem_motorista: {
        Args: {
          p_carga?: string
          p_cliente?: string
          p_data_prevista?: string
          p_destino: string
          p_id: string
          p_observacoes?: string
          p_origem: string
          p_valor_frete: number
          p_veiculo_id: string
        }
        Returns: undefined
      }
      definir_acesso_usuario: {
        Args: { p_ativo: boolean; p_usuario_id: string }
        Returns: undefined
      }
      desempenho_por_veiculo: {
        Args: { p_fim: string; p_inicio: string }
        Returns: {
          combustivel: number
          comissoes: number
          despesas: number
          faturamento: number
          km_rodado: number
          manutencoes: number
          margem_percentual: number
          modelo: string
          placa: string
          resultado: number
          veiculo_id: string
          viagens: number
          viagens_combustivel_estimado: number
        }[]
      }
      editar_viagem_motorista: {
        Args: {
          p_carga?: string
          p_cliente?: string
          p_data_prevista?: string
          p_destino: string
          p_id: string
          p_observacoes?: string
          p_origem: string
          p_valor_frete: number
          p_veiculo_id: string
        }
        Returns: undefined
      }
      finalizar_viagem: {
        Args: {
          p_data_hora_chegada?: string
          p_km_final: number
          p_local_chegada?: string
          p_observacoes_finais?: string
          p_viagem_id: string
        }
        Returns: undefined
      }
      gerar_codigo_ativacao: {
        Args: { p_motorista_id: string }
        Returns: string
      }
      iniciar_viagem: {
        Args: {
          p_iniciada_em?: string
          p_km_inicial: number
          p_viagem_id: string
        }
        Returns: undefined
      }
      meu_acesso: {
        Args: never
        Returns: {
          assinatura_dias_carencia: number
          assinatura_dias_restantes: number
          assinatura_em_carencia: boolean
          assinatura_liberada: boolean
          assinatura_status: string
          motorista_id: string
          nome: string
          papel: string
          primeiro_acesso: boolean
          tenant_id: string
          tenant_nome: string
        }[]
      }
      minha_plataforma: {
        Args: never
        Returns: {
          primeiro_acesso: boolean
        }[]
      }
      parada_sugerida: {
        Args: { p_viagem_id: string }
        Returns: {
          local_nome: string
          media_estrelas: number
          vezes: number
        }[]
      }
      plataforma_assinatura: {
        Args: { p_acao: string; p_dias?: number; p_tenant_id: string }
        Returns: undefined
      }
      plataforma_empresas: {
        Args: never
        Returns: {
          admin_email: string
          admin_id: string
          admin_nome: string
          admin_ultimo_login: string
          assinatura_dias_restantes: number
          assinatura_liberada: boolean
          assinatura_status: string
          criado_em: string
          nome: string
          pago_ate: string
          qtd_motoristas: number
          qtd_usuarios: number
          qtd_veiculos: number
          tenant_id: string
          trial_expira_em: string
        }[]
      }
      plataforma_usuarios: {
        Args: { p_tenant_id: string }
        Returns: {
          ativo: boolean
          id: string
          login: string
          nome: string
          papel: string
          primeiro_acesso: boolean
          ultimo_login: string
        }[]
      }
      resumo_financeiro: {
        Args: { p_fim: string; p_inicio: string }
        Returns: {
          adiantamento_a_devolver: number
          adiantamento_a_reembolsar: number
          adiantamentos_abertos: number
          combustivel: number
          comissoes: number
          custos_fixos: number
          custos_operacionais: number
          despesas: number
          faturamento: number
          km_rodado: number
          manutencoes: number
          resultado: number
          viagens: number
          viagens_combustivel_estimado: number
        }[]
      }
      resumo_motorista: {
        Args: { p_fim: string; p_inicio: string }
        Returns: {
          comissao: number
          km_rodado: number
          viagens: number
        }[]
      }
      revogar_aparelho: { Args: { p_motorista_id: string }; Returns: undefined }
      sou_superadmin: { Args: never; Returns: boolean }
      sugerir_adiantamento: {
        Args: { p_destino: string; p_origem: string }
        Returns: {
          quantidade: number
          valor: number
        }[]
      }
      usuarios_da_empresa: {
        Args: never
        Returns: {
          ativo: boolean
          id: string
          login: string
          motorista_id: string
          nome: string
          papel: string
          primeiro_acesso: boolean
          ultimo_login: string
        }[]
      }
      viagens_do_motorista: {
        Args: never
        Returns: {
          adiantamento_acertado: boolean
          adiantamento_gasto: number
          adiantamento_saldo: number
          atualizado_em: string
          carga: string
          cliente: string
          comissao_percentual: number
          comissao_valor: number
          data_hora_chegada: string
          data_prevista: string
          destino: string
          editavel: boolean
          forma_pagamento_frete: string
          gasto_proprio_bolso: number
          id: string
          iniciada_em: string
          km_final: number
          km_inicial: number
          local_chegada: string
          observacoes: string
          observacoes_finais: string
          origem: string
          status: string
          valor_adiantamento: number
          valor_frete: number
          valor_frete_total: number
          veiculo_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
