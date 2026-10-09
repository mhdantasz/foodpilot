# Guia de uso do Pronto

## Entrar e preparar seu negócio

Abra o endereço do aplicativo. Entre com email e senha. Em **Criar conta**, preencha seus dados e confirme o email recebido quando solicitado. Depois informe o nome do negócio, o que vende e onde costuma vender. Esses passos não criam produtos automaticamente.

Esqueceu a senha? Use **Esqueci minha senha**. Abra o link do email no mesmo navegador em que pediu a recuperação, escolha a nova senha e entre novamente. Não compartilhe links de recuperação.

## Produtos, clientes e locais

Em **Produtos → Novo produto**, informe nome, sabores, preço de venda e custo de cada sabor. O custo permite calcular lucro bruto. Não é controle de estoque. Use categorias quando ajudarem a organizar.

Em **Clientes → Novo cliente**, informe nome e, se desejar, telefone com DDD. O perfil mostra compras, saldo, frequência e histórico. Produtos/clientes com histórico devem ser **desativados**, preservando as compras antigas. Desativados deixam de aparecer para novos registros, mas continuam no histórico.

Em **Configurações → Locais de venda**, adicione Escola, Cursinho ou outro local. Pode editar e desativar. Não é necessário cadastrar filiais.

## Registrar uma venda

Toque em **Nova venda**, escolha os sabores e quantidades, confira o total e selecione o pagamento. Cliente e local são opcionais para venda paga; **Fiado exige cliente**. Finalize e aguarde **Venda registrada**. PIX/dinheiro/cartão são registros: o aplicativo não cobra nem verifica transferências bancárias.

Se a conexão falhar, não considere a venda confirmada. Confira o histórico; repetir a mesma tentativa não deve duplicá-la. Não recarregue ou feche o formulário antes de confirmar: os campos não são um rascunho permanente.

Errou? Abra a venda no histórico e escolha **Cancelar venda**. Informe o motivo. Se houve pagamento, devolva o valor fora do aplicativo e confirme a devolução. O cancelamento é definitivo: preserva itens, recibos, data e responsável, retira faturamento/lucro/fiado e registra a devolução no caixa do dia. Depois registre a venda correta. Não existe edição silenciosa de venda antiga.

## Fiados e pagamentos

Em **Fiados**, veja quem deve, saldo e pendência mais antiga. Abra o cliente ou a venda, escolha **Registrar pagamento**, informe o valor recebido e confirme. Pagamento parcial diminui o saldo; **Quitar tudo** distribui o valor pelas vendas abertas mais antigas do cliente. Não registre mais do que o saldo.

O botão WhatsApp abre a conversa com uma sugestão de texto. Confira o número e a mensagem antes de enviar. O aplicativo não envia mensagens automaticamente.

## Reservas e despesas

Em **Reservas → Nova reserva**, escolha itens, cliente/local e data/horário. A reserva preserva os preços daquele momento. Marque preparada/entregue quando adequado. **Converter em venda** registra uma única venda com aqueles itens/preços e o método escolhido. Reserva convertida não deve ser registrada novamente como nova venda. Para corrigir a venda convertida, abra-a e cancele; a reserva continua como registro histórico da conversão.

Em **Despesas**, adicione descrição, categoria, valor e data. Pode corrigir uma despesa existente. Não há exclusão nem histórico de versões de despesas nesta V1; revise antes de salvar.

## Acompanhar resultados

**Hoje** prioriza faturamento, lucro bruto, vendas e a receber. Lucro bruto desconta o custo dos itens; resultado desconta também despesas. **Recebido líquido** considera recebimentos menos devoluções na data, podendo ser negativo. Fiado aumenta faturamento, mas só aumenta recebido quando o cliente paga.

Em **Análises**, escolha o período e consulte vendas por produto, sabor, cliente e local. Médias incluem dias sem venda. Previsões são aproximadas e só aparecem com dados suficientes. Datas seguem **America/Manaus**; valores em **BRL**. Moeda/fuso ficam somente para consulta para preservar o significado do histórico.

## Exportar e guardar seus dados

Em **Configurações → Exportar dados**, escolha vendas, clientes, pagamentos ou despesas e período. O CSV abre em Excel/Google Sheets com UTF-8 e separador ponto e vírgula. Se necessário, importe escolhendo UTF-8, separador `;` e localidade Brasil. Nomes que começam como fórmulas recebem uma proteção de texto.

Vendas inclui vendas realizadas **ou canceladas** no período; confira separadamente data da venda, situação, valor original e devolução. Não some o valor original de canceladas como faturamento. Pagamentos preserva os recibos originais; a devolução aparece em vendas. Para clientes, o período usa a data do cadastro. Arquivos têm limite de 10.000 linhas; se exceder, escolha um período menor. CSV ajuda a consultar dados, mas **não restaura a conta nem substitui backup do banco**.

Guarde cópias em local privado. Consulte [backup e publicação](deployment.md) para proteção completa e limitações do plano gratuito.

## Instalar no celular ou computador

É necessário abrir o **endereço HTTPS publicado**. `localhost` do computador não é o endereço do celular.

- Android/Chrome: menu do navegador → **Instalar aplicativo** ou **Adicionar à tela inicial**.
- iPhone/iPad: abra no Safari → **Compartilhar → Adicionar à Tela de Início**.
- Computador/Chrome ou Edge: botão de instalação na barra de endereços ou menu **Instalar**.

Abra o ícone instalado. A navegação fica na parte inferior no celular; **Mais** abre as outras páginas. A disponibilidade do botão depende do navegador. A instalação não dispensa internet.

Sem conexão, o aplicativo avisa e bloqueia novas gravações. Campos da tela aberta são mantidos enquanto você permanece nela; fechar/recarregar pode perdê-los. Não há fila nem sincronização offline. Ao voltar à conexão, confira o histórico antes de repetir uma operação que ficou sem confirmação.

Use a mesma conta no celular e no computador. Abra/atualize a página para encontrar as alterações do outro aparelho. Finalize formulários antes de trocar de tela. Em aparelho compartilhado, use **Configurações → Sair da conta**.
