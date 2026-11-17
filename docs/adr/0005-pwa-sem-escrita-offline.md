# PWA instalável, mas sem funcionar offline

> Substituído pelo ADR 0010 (leitura offline). A escrita continua exigindo conexão.

O app é um PWA para poder ser instalado no celular, e o service worker guarda em cache apenas o "casco" (HTML, JS, CSS, ícones). Ler e gravar dados sempre exige conexão: não há cópia local dos dados nem fila de sincronização. Escrita offline traria resolução de conflitos entre o que foi feito sem rede e o que está no servidor, uma complexidade desproporcional para o uso pessoal.

## Consequences

Sem rede, o app abre mas não mostra nem salva nada. Quem for acrescentar cache de dados ou fila offline precisa antes decidir como resolver conflitos; não é só ligar uma opção do service worker.
