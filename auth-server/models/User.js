const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username é obrigatório'],
    unique: true,
    trim: true,
    minlength: [3, 'Username deve ter pelo menos 3 caracteres'],
    maxlength: [30, 'Username deve ter no máximo 30 caracteres'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username deve conter apenas letras, números e underscore']
  },
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email inválido']
  },
  password: {
    type: String,
    required: [true, 'Senha é obrigatória'],
    minlength: [6, 'Senha deve ter pelo menos 6 caracteres']
  },
  role: {
    type: String,
    enum: ['admin', 'user', 'moderator'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Middleware para hash da senha antes de salvar
userSchema.pre('save', async function(next) {
  // Só fazer hash se a senha foi modificada
  if (!this.isModified('password')) return next();
  
  try {
    // Hash da senha com salt de 12 rounds
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar senha
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Método para retornar dados seguros do usuário (sem senha)
userSchema.methods.toSafeObject = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

// Índices para performance (username e email já são únicos no schema)
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 }); // Para ordenação

module.exports = mongoose.model('User', userSchema);
