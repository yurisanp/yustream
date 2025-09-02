# 🔐 Instruções para Configuração SSL - YuStream

## 📋 Resumo das Melhorias Implementadas

✅ **Header sempre visível**: O header do player agora permanece visível mesmo durante erros de conexão
✅ **Tela de admin separada**: O painel administrativo agora é uma tela completa separada
✅ **Botão Stremio no login**: Adicionado botão para acessar `/configure` diretamente da tela de login
✅ **Configuração SSL completa**: Sistema completo de SSL com Let's Encrypt para `yustream.yurisp.com.br`

## 🚀 Como Configurar SSL

### 1. Preparação no Servidor Linux

No servidor onde o domínio `yustream.yurisp.com.br` está configurado:

```bash
# 1. Tornar scripts executáveis
chmod +x setup-ssl-complete.sh
chmod +x scripts/setup-ssl.sh
chmod +x scripts/setup-ome-ssl.sh
chmod +x scripts/renew-ssl.sh
chmod +x scripts/setup-firewall.sh

# 2. Executar configuração completa
sudo ./setup-ssl-complete.sh
```

### 2. Configuração Manual (Alternativa)

Se preferir configurar manualmente:

```bash
# 1. Configurar SSL básico
sudo ./scripts/setup-ssl.sh

# 2. Configurar SSL no OvenMediaEngine
sudo ./scripts/setup-ome-ssl.sh

# 3. Configurar firewall
sudo ./scripts/setup-firewall.sh

# 4. Iniciar serviços
docker-compose up -d
```

## 📁 Arquivos Criados/Modificados

### Novos Arquivos:
- `nginx/conf.d/ssl.conf` - Configuração SSL do Nginx
- `scripts/setup-ssl.sh` - Script para obter certificados SSL
- `scripts/setup-ome-ssl.sh` - Script para configurar SSL no OME
- `scripts/renew-ssl.sh` - Script para renovação automática
- `scripts/setup-firewall.sh` - Script para configurar firewall
- `setup-ssl-complete.sh` - Script principal de configuração
- `SSL_SETUP.md` - Documentação completa de SSL
- `yustream-react/src/components/AdminScreen.tsx` - Tela de admin separada
- `yustream-react/src/components/AdminScreen.css` - Estilos da tela de admin

### Arquivos Modificados:
- `docker-compose.yml` - Adicionados volumes SSL e porta 8443
- `ome-config/Server.xml` - Configuração SSL do OvenMediaEngine
- `yustream-react/src/components/OvenStreamPlayer.tsx` - Suporte a HTTPS
- `yustream-react/src/components/OvenStreamPlayer.css` - Header sempre visível
- `yustream-react/src/components/Login.tsx` - Botão para /configure

## 🌐 URLs Disponíveis Após SSL

- **Site principal**: https://yustream.yurisp.com.br
- **Configuração Stremio**: https://yustream.yurisp.com.br/configure
- **API**: https://yustream.yurisp.com.br/api/
- **Stream HTTP**: http://yustream.yurisp.com.br:8080/live/live/abr.m3u8
- **Stream HTTPS**: https://yustream.yurisp.com.br:8443/live/live/abr.m3u8

## 🔧 Funcionalidades Implementadas

### 1. Header Sempre Visível
- O header do player agora tem `z-index: 15` para ficar acima dos overlays
- Botões de Stremio, Admin e Logout sempre acessíveis
- Informações do usuário sempre visíveis

### 2. Tela de Admin Separada
- Nova tela completa para administração
- Botão "Voltar ao Player" para retornar
- Interface dedicada com header próprio
- Melhor experiência para gerenciamento de usuários

### 3. Botão Stremio no Login
- Botão destacado na tela de login
- Redirecionamento direto para `/configure`
- Design atrativo com gradiente
- Facilita acesso à configuração do addon

### 4. SSL Dinâmico
- Certificados Let's Encrypt automáticos
- Renovação automática via cron job
- Suporte a HTTP e HTTPS
- Configuração segura do OvenMediaEngine
- Firewall configurado automaticamente

## 🔄 Renovação Automática

Os certificados SSL são renovados automaticamente:
- Cron job configurado para verificar a cada 3h
- Renovação 30 dias antes do vencimento
- Logs em `./logs/ssl-renewal.log`

## 🐛 Solução de Problemas

### Se o SSL não funcionar:
1. Verifique se o domínio está resolvendo: `nslookup yustream.yurisp.com.br`
2. Verifique se as portas 80 e 443 estão abertas
3. Verifique os logs: `docker-compose logs -f`
4. Verifique os certificados: `sudo certbot certificates`

### Se o player não carregar:
1. Verifique se o OME está funcionando: `docker-compose logs ovenmediaengine`
2. Verifique se as portas 8080 e 8443 estão acessíveis
3. Verifique se os certificados SSL estão corretos

## 📞 Próximos Passos

1. **Configure o DNS**: Certifique-se de que `yustream.yurisp.com.br` aponta para o servidor
2. **Execute o script SSL**: `sudo ./setup-ssl-complete.sh`
3. **Teste as funcionalidades**: Acesse https://yustream.yurisp.com.br
4. **Configure o Stremio**: Use o botão na tela de login ou acesse `/configure`

## 🎉 Resultado Final

Após a configuração, você terá:
- ✅ SSL funcionando em todo o sistema
- ✅ Header sempre visível no player
- ✅ Tela de admin dedicada
- ✅ Acesso fácil à configuração do Stremio
- ✅ Renovação automática de certificados
- ✅ Firewall configurado
- ✅ URLs HTTPS funcionando

O sistema estará completamente funcional e seguro para produção!
