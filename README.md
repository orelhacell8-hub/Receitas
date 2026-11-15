# Doce Ritual

Loja digital em português para vender receitas e cursos em PDF, criada com Next.js, React, TypeScript, Supabase e integração PIX no servidor.

## Rodar localmente

1. Crie um projeto no Supabase e execute [`supabase/schema.sql`](./supabase/schema.sql) no SQL Editor. O script cria as tabelas, categorias e produtos de demonstração e o bucket privado para os PDFs.
2. Copie `.env.example` para `.env.local` e preencha as variáveis do Supabase. A chave `SUPABASE_SERVICE_ROLE_KEY` é privada e deve existir somente no servidor.
3. Configure `ADMIN_PASSWORD` e `ADMIN_SESSION_SECRET` com valores fortes e exclusivos. Não use a senha administrativa como segredo de sessão.
4. Instale as dependências e inicie o ambiente:

   ```bash
   npm install
   npm run dev
   ```

5. Acesse `http://localhost:3000` para a loja e `http://localhost:3000/admin` para o painel. No painel, envie o PDF de cada produto antes de ativar a venda.

O cadastro e o login de clientes usam Supabase Auth. Configure o provedor de e-mail e os endereços de redirecionamento no painel do Supabase antes de publicar.

## Pagamentos NXGATE

Configure `NXGATE_API_KEY` na Railway (ou em `.env.local` durante o desenvolvimento). A integração segue a [documentação REST oficial da NXGATE](https://nxgate.com.br/doc): cria a cobrança em `POST /v2/cobranca`, envia a chave no corpo e usa `X-Idempotency-Key`; não usa client ID, client secret nem webhook. A confirmação consulta `POST /v2/consultar` a cada 5 segundos e só libera o PDF quando a API responde `status: "paid"` para o `transaction_id` daquele pedido. Quando a API não retornar o QR Code em base64, a loja o gera localmente a partir do código PIX.

O gateway começa desligado. Ative-o no painel depois de configurar a chave, cadastrar os PDFs e validar a integração com uma cobrança de teste.

## Publicar na Railway

Crie um serviço Railway a partir deste repositório, use o build e start padrão (`npm run build` e `npm run start`) e configure as variáveis do `.env.example` em **Variables**. Não envie `.env.local` ou a service role key para o Git. Configure também o domínio público no Supabase Auth.

## Segurança e operação

- O painel `/admin` usa senha e cookie assinado, `HttpOnly`, `SameSite=Strict`, com expiração. Defina `ADMIN_PASSWORD` e `ADMIN_SESSION_SECRET` na Railway; a senha não fica gravada no código.
- O bucket `course-pdfs` é privado. O backend só entrega um link temporário depois de confirmar o pagamento.
- Os pedidos não armazenam CPF/CNPJ; o documento é enviado à NXGATE apenas ao criar a cobrança.
- A confirmação PIX é consultada a cada 5 segundos enquanto o checkout estiver aberto.
