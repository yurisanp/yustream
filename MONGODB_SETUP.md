# YuStream - MongoDB & Gerenciamento de Usuários

## 🆕 Novas Funcionalidades Implementadas

### ✅ **1. Hot Reload no Auth Server**
- **Docker otimizado** com volumes para desenvolvimento
- **Nodemon** para reinicialização automática
- **Sem necessidade de rebuild** do container para mudanças no código

### ✅ **2. Banco de Dados MongoDB**
- **MongoDB 7 Alpine** integrado
- **Mongoose ODM** para modelagem de dados
- **Usuários persistentes** com validação completa
- **Índices otimizados** para performance

### ✅ **3. Painel Administrativo**
- **Interface completa** para gerenciar usuários
- **CRUD completo** (Create, Read, Update, Delete)
- **Paginação e busca** em tempo real
- **Estatísticas** de usuários
- **Validações avançadas** de formulário

## 🗄️ **Estrutura do Banco de Dados**

### Modelo de Usuário (MongoDB)
```javascript
{
  _id: ObjectId,
  username: String (único, 3-30 chars),
  email: String (único, formato email),
  password: String (hash bcrypt),
  role: String ('admin', 'user', 'moderator'),
  isActive: Boolean,
  lastLogin: Date,
  createdBy: ObjectId (referência),
  createdAt: Date,
  updatedAt: Date
}
```

### Usuários Padrão
- **admin** / admin@yustream.com / admin123 (Administrador)
- **user** / user@yustream.com / password (Usuário)
- **moderator** / moderator@yustream.com / moderator123 (Moderador)

## 🚀 **Como Iniciar o Sistema Atualizado**

### Primeira Execução (Com MongoDB)

#### Windows:
```bash
start-auth.bat
```

#### Linux/macOS:
```bash
./start.sh
```

### Durante o Desenvolvimento

O sistema agora suporta **hot reload** no auth-server:
- Modifique arquivos em `auth-server/`
- O servidor reinicia automaticamente
- Sem necessidade de rebuild do container

## 🔧 **Configuração do Ambiente**

### Variáveis de Ambiente (.env)
```env
NODE_ENV=development
PORT=3001
JWT_SECRET=yustream-jwt-secret-change-in-production-2024
CORS_ORIGIN=*
STREAM_CHECK_URL=http://ovenmediaengine:8080/live/live/abr.m3u8
MONGODB_URI=mongodb://yustream:yustream123@mongodb:27017/yustream?authSource=admin
```

### MongoDB Configuração
- **Host:** mongodb:27017
- **Database:** yustream
- **User:** yustream
- **Password:** yustream123
- **Auth Source:** admin

## 👤 **Painel Administrativo**

### Acesso
1. Faça login como **admin** (admin / admin123)
2. Clique no botão **"Admin"** no header
3. Gerencie usuários através da interface

### Funcionalidades
- ✅ **Listar usuários** com paginação
- ✅ **Buscar** por username/email
- ✅ **Criar novos usuários**
- ✅ **Editar usuários** existentes
- ✅ **Deletar usuários**
- ✅ **Ativar/Desativar** usuários
- ✅ **Estatísticas** em tempo real
- ✅ **Controle de roles** (admin, user, moderator)

### Validações
- Username único (3-30 caracteres, apenas letras/números/_)
- Email único e válido
- Senha mínima de 6 caracteres
- Role obrigatório
- Não pode deletar a própria conta
- Não pode alterar próprio role de admin

## 🔒 **API de Gerenciamento (Admin)**

### Listar Usuários
```http
GET /api/admin/users?page=1&limit=10
Authorization: Bearer <token>
```

### Criar Usuário
```http
POST /api/admin/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "novousuario",
  "email": "novo@email.com",
  "password": "senha123",
  "role": "user"
}
```

### Atualizar Usuário
```http
PUT /api/admin/users/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "usuarioatualizado",
  "email": "atualizado@email.com",
  "role": "moderator",
  "isActive": true
}
```

### Deletar Usuário
```http
DELETE /api/admin/users/:id
Authorization: Bearer <token>
```

### Estatísticas
```http
GET /api/admin/stats
Authorization: Bearer <token>
```

## 🐳 **Docker Compose Atualizado**

### Serviços
```yaml
services:
  mongodb:          # Banco de dados
  yustream-auth:    # API com hot reload
  ovenmediaengine:  # Streaming server
  nginx:            # Proxy reverso
```

### Volumes
- `mongodb_data:/data/db` - Dados persistentes do MongoDB
- `./auth-server:/app` - Hot reload do código
- `/app/node_modules` - Cache de dependências

## 🔄 **Comandos Úteis**

### Ver Logs
```bash
# Todos os serviços
docker-compose logs -f

# Apenas auth server
docker-compose logs -f yustream-auth

# Apenas MongoDB
docker-compose logs -f mongodb
```

### Acessar MongoDB
```bash
# Via container
docker-compose exec mongodb mongosh -u yustream -p yustream123 --authenticationDatabase admin yustream

# Via cliente externo
mongosh "mongodb://yustream:yustream123@localhost:27017/yustream?authSource=admin"
```

### Reiniciar Serviços
```bash
# Reiniciar apenas auth
docker-compose restart yustream-auth

# Reiniciar tudo
docker-compose restart
```

### Backup do MongoDB
```bash
docker-compose exec mongodb mongodump -u yustream -p yustream123 --authenticationDatabase admin --db yustream --out /backup
```

## 🎯 **Fluxo de Desenvolvimento**

### 1. Modificar Backend
- Edite arquivos em `auth-server/`
- Nodemon reinicia automaticamente
- Logs visíveis em tempo real

### 2. Modificar Frontend
- Edite arquivos em `yustream-react/src/`
- Execute `npm run build` no diretório
- Nginx serve os arquivos atualizados

### 3. Testar Funcionalidades
- Login como admin
- Acesse painel administrativo
- Teste CRUD de usuários
- Verifique autenticação de streams

## 🛡️ **Segurança Aprimorada**

### Validações de Backend
- **Express Validator** para entrada de dados
- **Mongoose Schema** para validação de modelo
- **Rate Limiting** específico por rota
- **Sanitização** automática de dados

### Controle de Acesso
- **Middleware requireAdmin** para rotas administrativas
- **JWT tokens** com expiração
- **Verificação de roles** em tempo real
- **Auditoria** de criação de usuários

## 📊 **Performance**

### Índices MongoDB
- Username (único)
- Email (único)
- Role (composto)
- isActive (filtro)
- createdAt (ordenação)

### Paginação
- **Limite padrão:** 10 usuários por página
- **Skip/Limit** otimizado
- **Contagem total** eficiente

---

## 🎉 **Sistema Completamente Atualizado!**

Agora você tem:
- ✅ **Hot reload** para desenvolvimento eficiente
- ✅ **MongoDB** para persistência de dados
- ✅ **Painel administrativo** completo
- ✅ **API REST** para gerenciamento
- ✅ **Validações robustas**
- ✅ **Interface moderna** e responsiva

**Pronto para desenvolvimento e produção!** 🚀
