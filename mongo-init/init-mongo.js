// Inicialização do MongoDB para YuStream

// Usar o banco de dados yustream
db = db.getSiblingDB('yustream');

// Criar coleções
db.createCollection('users');

// Criar índices para melhor performance
// (username e email serão criados automaticamente pelo Mongoose com unique: true)
db.users.createIndex({ "role": 1 });
db.users.createIndex({ "isActive": 1 });
db.users.createIndex({ "createdAt": -1 });

print('🗄️  Banco de dados YuStream inicializado com sucesso!');
