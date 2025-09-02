const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`🗄️  MongoDB conectado: ${conn.connection.host}`);
    
    // Event listeners para monitorar a conexão
    mongoose.connection.on('error', (err) => {
      console.error('❌ Erro na conexão MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB desconectado');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconectado');
    });

    return conn;
  } catch (error) {
    console.error('❌ Erro ao conectar com MongoDB:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
