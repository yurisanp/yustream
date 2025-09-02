const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const initUsers = async (shouldConnect = false) => {
  try {
    // Conectar ao MongoDB apenas se solicitado (quando executado diretamente)
    if (shouldConnect) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('📦 Conectado ao MongoDB');
    }

    // Verificar se já existem usuários
    const existingUsers = await User.countDocuments();
    if (existingUsers > 0) {
      console.log('👥 Usuários já existem no banco de dados');
      return;
    }

    // Criar usuários padrão
    const defaultUsers = [
      {
        username: 'admin',
        email: 'admin@yustream.com',
        password: 'admin123',
        role: 'admin'
      },
      {
        username: 'user',
        email: 'user@yustream.com', 
        password: 'password',
        role: 'user'
      },
      {
        username: 'moderator',
        email: 'moderator@yustream.com',
        password: 'moderator123',
        role: 'moderator'
      }
    ];

    // Inserir usuários
    for (const userData of defaultUsers) {
      try {
        const user = new User(userData);
        await user.save();
        console.log(`✅ Usuário criado: ${userData.username} (${userData.role})`);
      } catch (userError) {
        console.error(`❌ Erro ao criar usuário ${userData.username}:`, userError.message);
      }
    }

    console.log('🎉 Usuários padrão processados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao criar usuários padrão:', error.message);
  } finally {
    // Fechar conexão apenas se foi aberta por este script
    if (shouldConnect) {
      await mongoose.connection.close();
    }
  }
};

// Executar se chamado diretamente
if (require.main === module) {
  initUsers(true); // Conectar ao banco quando executado diretamente
}

module.exports = initUsers;
