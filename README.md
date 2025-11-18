# PostgreSQL MCP Server

Servidor MCP (Model Context Protocol) para acesso somente-leitura a bancos de dados PostgreSQL. Permite que assistentes de IA como Claude consultem bancos PostgreSQL de forma segura.

## Funcionalidades

- **Acesso Somente-Leitura**: Apenas queries SELECT são permitidas (modo seguro padrão)
- **Modo Inseguro (Opcional)**: Permite operações de escrita (INSERT, UPDATE, DELETE) para desenvolvimento
- **Paginação**: Suporte a limit e offset para consultas grandes
- **Validação de Segurança**: Prevenção de SQL injection, limites de tamanho e timeout
- **Múltiplos Formatos**: Saída em TEXT, JSON, YAML ou TOON (otimizado para LLMs)
- **Suporte SSH Tunnel**: Conexão segura via bastion/jump host
- **Ferramentas MCP**:
  - `query` - Executar queries SQL (SELECT ou CRUD se insecure=true)
  - `list_tables` - Listar tabelas de um schema
  - `describe_table` - Detalhar estrutura de tabela (colunas, índices, foreign keys)

## Requisitos

- [Bun](https://bun.sh) v1.0+
- PostgreSQL 12+

## Instalação

```bash
bun install
```

## Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` baseado no exemplo:

```bash
cp .env.example .env
```

**Conexão Direta:**

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=mydb
POSTGRES_USER=postgres
POSTGRES_PASSWORD=sua_senha
POSTGRES_MAX_CONNECTIONS=10

# Modo inseguro - permite operações de escrita (default: false)
# ⚠️ ATENÇÃO: Use apenas em ambientes de desenvolvimento/teste
POSTGRES_INSECURE=false
```

**Conexão via SSH Tunnel:**

```env
POSTGRES_HOST=db-interno.example.com
POSTGRES_PORT=5432
POSTGRES_DATABASE=mydb
POSTGRES_USER=postgres
POSTGRES_PASSWORD=sua_senha

SSH_TUNNEL_ENABLED=true
SSH_HOST=bastion.example.com
SSH_PORT=22
SSH_USERNAME=seu_usuario
SSH_PASSWORD=sua_senha_ssh
# ou
SSH_PRIVATE_KEY_PATH=/home/user/.ssh/id_rsa
```

### Configuração MCP Client

Adicione ao seu cliente MCP (ex: Claude Desktop):

```json
{
  "mcpServers": {
    "postgres": {
      "command": "bun",
      "args": ["run", "/caminho/para/mcp-database-client/index.ts"],
      "env": {
        "POSTGRES_HOST": "localhost",
        "POSTGRES_PORT": "5432",
        "POSTGRES_DATABASE": "mydb",
        "POSTGRES_USER": "postgres",
        "POSTGRES_PASSWORD": "sua_senha"
      }
    }
  }
}
```

## Uso

### Executar Servidor

```bash
# Produção
bun start

# Desenvolvimento (hot reload)
bun dev

# Build executável standalone
bun run build
./mcp-database-client
```

### Ferramentas Disponíveis

**query** - Executar SQL com paginação:
```json
{
  "sql": "SELECT * FROM users WHERE age > 18",
  "limit": 50,
  "offset": 100,
  "format": "JSON"
}
```

Resposta inclui metadados de paginação:
```json
{
  "data": [...],
  "rowCount": 50,
  "pagination": {
    "limit": 50,
    "offset": 100,
    "hasMore": true
  }
}
```

**list_tables** - Listar tabelas:
```json
{
  "schema": "public",
  "format": "TEXT"
}
```

**describe_table** - Descrever tabela:
```json
{
  "table": "users",
  "schema": "public",
  "format": "YAML"
}
```

### Formatos de Saída

- **TEXT** - Formato tabular legível
- **JSON** - JSON formatado com indentação
- **YAML** - YAML estruturado
- **TOON** - Token-Oriented Object Notation (otimizado para LLMs, padrão)

## Segurança

### Validações Implementadas

1. **Query Read-Only** (padrão): Apenas SELECT e WITH (CTEs) permitidos
2. **Keywords Bloqueadas**: INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT, REVOKE, EXEC, EXECUTE, CALL, COPY, IMPORT
3. **Padrões Bloqueados**: INTO OUTFILE, LOAD DATA
4. **Normalização**: Remove comentários SQL para evitar bypass
5. **Limites**:
   - Tamanho máximo: 10.000 caracteres
   - Máximo de linhas retornadas: 1.000 (ajustável via paginação)
   - Timeout: 30 segundos
6. **Queries Parametrizadas**: Para list_tables e describe_table

### Modo Inseguro (Desenvolvimento)

⚠️ **ATENÇÃO**: Use apenas em ambientes de desenvolvimento/teste!

Quando `POSTGRES_INSECURE=true`, todas as operações SQL são permitidas:

```env
POSTGRES_INSECURE=true
```

Isso habilita:
- INSERT, UPDATE, DELETE
- CREATE, ALTER, DROP
- TRUNCATE, GRANT, REVOKE
- Todas as operações DDL e DML

**Avisos de segurança:**
```
⚠️  WARNING: INSECURE MODE ENABLED - Write operations are allowed
[WARN] INSECURE MODE: Query validation bypassed - write operations allowed
```

### Logging de Segurança

Todas as queries bloqueadas são logadas com detalhes:

```
[SECURITY] Query blocked: contains blocked keyword {"keyword":"INSERT"}
[SECURITY] Query blocked: exceeds maximum length {"queryLength":10500}
```

## Testes

O projeto inclui 174 testes unitários cobrindo segurança, formatação e validação.

```bash
# Executar todos os testes
bun test

# Com relatório de cobertura
bun test --coverage

# Teste específico
bun test src/security.test.ts
```

### Cobertura de Testes

| Módulo              | Funções  | Linhas |
|---------------------|----------|--------|
| security.ts         | 100%     | 100%   |
| config.ts           | 100%     | 100%   |
| query-tool.ts       | 100%     | 100%   |
| formatter.ts        | 88.89%   | 93.65% |
| list-tables-tool.ts | 66.67%   | 92.31% |

## Estrutura do Projeto

```
mcp-database-client/
├── index.ts                          # Entry point MCP server
├── src/
│   ├── config.ts                     # Configuração do banco
│   ├── database.ts                   # Pool de conexões
│   ├── security.ts                   # Validação de queries
│   ├── formatter.ts                  # Formatação de saída
│   ├── logger.ts                     # Sistema de logging
│   ├── ssh-tunnel.ts                 # Suporte SSH tunnel
│   ├── *.test.ts                     # Testes unitários
│   └── tools/
│       ├── query-tool.ts             # Ferramenta query
│       ├── list-tables-tool.ts       # Ferramenta list_tables
│       ├── describe-table-tool.ts    # Ferramenta describe_table
│       └── *.test.ts                 # Testes das ferramentas
├── package.json
├── tsconfig.json
└── CLAUDE.md                         # Instruções para Claude Code
```

## Logging

### Níveis de Log

Configure via `LOG_LEVEL`:

```env
LOG_LEVEL=info  # debug | info | warn | error
```

### Formato

```env
LOG_FORMAT=json  # ou text (padrão)
```

### Exemplos

```
[2025-01-15T10:30:45.123Z] INFO: [QUERY] Executing SQL query {"queryLength":45}
[2025-01-15T10:30:45.234Z] INFO: [QUERY] Query executed successfully {"rowCount":150,"duration":111}
[2025-01-15T10:30:50.456Z] WARN: [SECURITY] Query blocked: contains blocked keyword {"keyword":"INSERT"}
```

## Troubleshooting

### Erros de Conexão

1. Verifique se PostgreSQL está rodando:
   ```bash
   pg_isready -h localhost -p 5432
   ```

2. Confira credenciais no `.env`

3. Verifique firewall e `pg_hba.conf`

### Query Bloqueada

- Query deve iniciar com SELECT ou WITH
- Não pode conter keywords de escrita (INSERT, UPDATE, DELETE, etc.)
- Tamanho máximo: 10.000 caracteres

### Timeout

- Otimize queries com índices
- Divida queries grandes
- Verifique performance do banco

## Stack Técnica

- **Runtime**: [Bun](https://bun.sh)
- **Database**: PostgreSQL via `postgres` library
- **Protocol**: [Model Context Protocol (MCP)](https://modelcontextprotocol.io)
- **Transport**: stdio

## Licença

MIT

## Links

- [Model Context Protocol](https://modelcontextprotocol.io)
- [Bun Documentation](https://bun.sh/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
