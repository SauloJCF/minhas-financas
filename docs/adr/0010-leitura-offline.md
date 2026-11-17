# PWA com leitura offline, sem escrita offline

Substitui o ADR 0005. O service worker continua guardando só o "casco" (HTML, JS, CSS, ícones), mas agora as consultas também ficam no aparelho. O cache do TanStack Query é salvo no IndexedDB (`@tanstack/react-query-persist-client` com `idb-keyval`) e restaurado quando o app abre. Sem rede, o app mostra o que já tinha carregado e avisa de quando são os dados. Gravar continua exigindo conexão: sem rede, as ações de salvar, pagar, arquivar e excluir ficam desligadas. A escrita fica para a #27, porque só a leitura dispensa a resolução de conflitos que o ADR 0005 apontava.

## Considered Options

- **Cache de API no service worker (Workbox `runtimeCaching`)**: guardaria as respostas do Supabase sem mudar o front, mas criaria um segundo cache ao lado do TanStack Query, com regras próprias de validade. Além disso, as respostas com `Authorization` de um usuário ficariam no Cache Storage sem separação por usuário.
- **Cópia local do banco com sincronização (PowerSync, ElectricSQL, RxDB)**: daria leitura e escrita offline, mas muda todo o acesso a dados e exige uma política de conflitos. É desproporcional para um app pessoal.

## Consequences

- Só fica offline o que já foi aberto com rede. Uma tela nunca visitada mostra "Carregando…" até a conexão voltar.
- O cache vale por 7 dias e é descartado a cada versão publicada (`buster` é a `__APP_VERSION__`), para uma versão nova não ler dados num formato antigo.
- "Sair" apaga o cache da memória e do IndexedDB. As chaves já levam o id do usuário, mas dados financeiros não devem ficar no aparelho depois do logout.
- As configurações do assistente (que guardam a chave do OpenRouter) e a lista de modelos nunca vão para o aparelho. Sem rede, o assistente avisa que precisa de conexão.
- O estado de rede vem do `navigator.onLine`, inclusive na abertura do app: o `onlineManager` do TanStack Query, sozinho, começa achando que está online. Numa rede que conecta mas não entrega nada, o app se acha online e as consultas podem falhar.
- Quem for implementar a escrita offline (#27) parte daqui: a fila de mutações pode ser persistida pelo mesmo mecanismo.
