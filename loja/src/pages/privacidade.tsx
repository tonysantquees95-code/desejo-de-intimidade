import React from "react";
import { ShopLayout } from "../components/ShopLayout";
import styles from "./privacidade.module.css";

const EMAIL = "desejodeintimidade@gmail.com";
const WHATSAPP = "(51) 98181-1400";
const ATUALIZADA = "5 de novembro de 2026";

/** Política de privacidade e termos de uso (LGPD). Também é o endereço pedido pela Meta para o app do Instagram. */
export default function PrivacidadePage() {
  return (
    <ShopLayout title="Privacidade e termos" subtitle={`Política de privacidade e termos de uso da Desejo de Intimidade. Atualizada em ${ATUALIZADA}.`}>
      <article className={styles.texto}>
        <h2>1. Quem cuida dos seus dados</h2>
        <p>
          A Desejo de Intimidade, loja online de moda íntima e sex shop com sede em Porto Alegre (RS), é a controladora dos dados
          pessoais tratados neste site, no WhatsApp e no Instagram da loja, nos termos da Lei Geral de Proteção de Dados (Lei
          13.709/2018, LGPD). Para qualquer assunto sobre os seus dados, fale com a gente pelo e-mail <a href={`mailto:${EMAIL}`}>{EMAIL}</a> ou
          pelo WhatsApp {WHATSAPP}.
        </p>

        <h2>2. Quais dados usamos e para quê</h2>
        <ul>
          <li>
            <strong>Cadastro:</strong> nome, e-mail e senha (guardada só de forma cifrada), para você acompanhar seus pedidos.
          </li>
          <li>
            <strong>Compra e entrega:</strong> CPF, telefone e endereço, para emitir a etiqueta, entregar o pedido e cumprir obrigações
            legais e fiscais.
          </li>
          <li>
            <strong>Pagamento:</strong> processado pela InfinitePay. Você digita os dados do cartão na página da
            InfinitePay, e eles nunca passam pelo nosso servidor nem ficam guardados conosco.
          </li>
          <li>
            <strong>Atendimento:</strong> as mensagens que você manda pelo site, WhatsApp ou Direct do Instagram, para responder suas
            dúvidas. A assistente virtual Vênus pode responder automaticamente; quando necessário, alguém da equipe assume.
          </li>
          <li>
            <strong>Avisos:</strong> se você permitir, notificações sobre o seu pedido.
          </li>
        </ul>
        <p>Não vendemos nem alugamos seus dados, e não usamos seus dados para publicidade de terceiros.</p>

        <h2>3. Com quem os dados são compartilhados</h2>
        <p>Só com quem precisa deles para a loja funcionar:</p>
        <ul>
          <li>InfinitePay (pagamentos);</li>
          <li>Melhor Envio e Correios, ou o entregador por motoboy em Porto Alegre (entregas);</li>
          <li>Floot (hospedagem do site e do banco de dados);</li>
          <li>Meta (WhatsApp e Instagram), quando você fala com a loja por esses canais;</li>
          <li>
            serviços de inteligência artificial (Groq, Cloudflare e Google Gemini), que recebem só o texto da pergunta para a Vênus
            responder, sem o seu nome, CPF, telefone ou endereço.
          </li>
        </ul>
        <p>Também podemos informar dados quando a lei ou uma autoridade exigir.</p>

        <h2>4. Discrição</h2>
        <p>
          A embalagem é lacrada e não identifica o conteúdo. Na etiqueta não aparece nada que revele o tipo de produto. As
          conversas do robô de atendimento são guardadas sem o seu nome ou número (só um código) e apagadas em até 14 dias.
        </p>

        <h2>5. Por quanto tempo guardamos</h2>
        <p>
          Os dados de cadastro ficam enquanto a sua conta existir. Os dados de pedidos ficam pelo prazo exigido pela legislação fiscal
          e de defesa do consumidor. Conversas do atendimento automático são apagadas em até 14 dias.
        </p>

        <h2>6. Seus direitos</h2>
        <p>
          Você pode, a qualquer momento e sem custo: confirmar se tratamos seus dados, ter acesso a eles, corrigir dados errados,
          pedir a exclusão, pedir a portabilidade, saber com quem compartilhamos e revogar consentimentos (art. 18 da LGPD).
        </p>

        <h2 id="exclusao">7. Como pedir a exclusão dos seus dados</h2>
        <p>
          Mande um e-mail para <a href={`mailto:${EMAIL}?subject=Exclus%C3%A3o%20de%20dados`}>{EMAIL}</a> ou uma mensagem no WhatsApp{" "}
          {WHATSAPP} com o assunto “Exclusão de dados”, informando o e-mail da conta ou o seu usuário do Instagram. Apagamos em até 15
          dias e confirmamos por mensagem. Guardamos apenas o que a lei obriga (por exemplo, dados de pedidos para fins fiscais).
        </p>

        <h2>8. Segurança</h2>
        <p>
          O site usa conexão segura (HTTPS), senhas cifradas e acesso ao painel só para a equipe. Nenhum sistema é 100% seguro; se
          acontecer um incidente que possa te afetar, avisaremos você e a ANPD.
        </p>

        <h2>9. Termos de uso</h2>
        <ul>
          <li>As vendas são exclusivas para maiores de 18 anos.</li>
          <li>
            Preços, promoções e estoque podem mudar sem aviso; vale o que aparece no carrinho no momento da compra. Frete e prazo são
            calculados pelo CEP antes do pagamento.
          </li>
          <li>
            Compras pela internet podem ser desistidas em até 7 dias após o recebimento (art. 49 do Código de Defesa do Consumidor).
            Por higiene e segurança, produtos de uso íntimo só são aceitos de volta lacrados e sem uso, salvo defeito.
          </li>
          <li>Produtos com defeito seguem as regras de garantia do Código de Defesa do Consumidor.</li>
          <li>
            Trocas, devoluções e reembolsos: veja a página <a href="/trocas">Trocas e devoluções</a>.
          </li>
          <li>As fotos são ilustrativas; cores podem variar um pouco conforme a tela.</li>
        </ul>

        <h2>10. Mudanças nesta política</h2>
        <p>Quando esta página mudar, a data de atualização no topo também muda.</p>
      </article>
    </ShopLayout>
  );
}