# ScrollScape Dashboard

Uma consola de monitorização em modo terminal para uma instância do ScrollScape a
correr — saúde das sources, resumo da biblioteca, downloads em massa em curso, e
uso de recursos (CPU, RAM, rede) do próprio processo do servidor.
Feita em Python com [Textual](https://github.com/Textualize/textual).

É um cliente **só de leitura**: liga-se pela API REST já existente do ScrollScape
(`/api/system/health`, `/api/library`, `/api/download/bulk/jobs`, etc.), sem tocar
no `store.json` nem no processo Node — corre em paralelo com o servidor normal e
com a interface web, sem interferir com nenhum dos dois.

## Instalar

```bash
pip install -r requirements.txt
```

## Correr

Com o ScrollScape já a correr (ex. via `Launch-ScrollScape.bat` ou `npm start`):

```bash
python dashboard.py
```

Por defeito liga a `http://localhost:4000`. Para apontar a outra instância/porta:

```bash
python dashboard.py --url http://192.168.1.50:4000
```

Se a instância tiver uma password definida (Settings → proteção de acesso):

```bash
python dashboard.py --password "a-tua-password"
```

ou define `SCROLLSCAPE_PASSWORD` no ambiente em vez de passar em texto simples na
linha de comandos.

## Teclas

- `r` — atualizar já (por defeito atualiza sozinho a cada 8s, `--interval` muda isto)
- `q` — sair

## Nota sobre Windows

Mensagens de erro de sources com acentos (ex. "indisponível") podem aparecer
corrompidas na consola `cmd.exe` clássica devido à codepage por defeito. Usa o
Windows Terminal (ou PowerShell 7+) para Unicode correto — ou corre
`chcp 65001` antes de `python dashboard.py` na `cmd.exe` antiga.

## O que NÃO mostra (ainda)

O progresso em tempo real de um import do AniList não é visível aqui — esse
pipeline corre inteiramente no browser (`public/modules/anilist.js`), não no
servidor, por isso não há nada para este dashboard consultar durante um import a
decorrer. O que dá para ver é o resumo da **última** sincronização já concluída
(`GET /api/anilist/sync-meta`).
