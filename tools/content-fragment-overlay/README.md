# Content fragment overlay (Article)

Publishes AEM "Article" content fragments as self-contained Edge Delivery pages, as
described in https://www.aem.live/developer/content-fragment-overlay.
No block, GraphQL query or AEM page is needed.

| Fragment in AEM | Published at |
| --- | --- |
| `/content/dam/midwives/articles/<name>` | `/articles/<name>` |

## Pieces

| Piece | Where | Status |
| --- | --- | --- |
| Mustache template | `cf-templates/article.html` (served from the code bus) | in the repo |
| Path mapping `/content/dam/midwives/articles/:/articles/` | site config `public.json` → `paths.mappings`, mirrored in `paths.json` | applied |
| Model allow-list `/conf/midwives/settings/dam/cfm/models/article` | site config `public.json` → `xwalk.content-fragment-overlay` | applied |
| json2html service config | `json2html-config.json` → `POST https://json2html.adobeaem.workers.dev/config/bhasakatech/midwives/main` (needs `Authorization: token <admin-api-token>`) | **to do** |
| Overlay on the content source | site config `content.json` → `overlay` (below) | **to do, after the json2html config** |

```json
"overlay": {
  "url": "https://json2html.adobeaem.workers.dev/bhasakatech/midwives/main",
  "type": "markup"
}
```

Add the overlay only after the json2html config is saved: until then the service
answers 500 for every path, and Edge Delivery checks the overlay first.

## AEM prerequisites

- Content Fragments enabled for the site and an Edge Delivery configuration applied
  to `/content/dam/midwives/articles`.
- Content fragment model **Article** in `/conf/midwives` with fields:

  | Field name | Type |
  | --- | --- |
  | `title` | Single line text (required) |
  | `summary` | Multi line text, plain text |
  | `author` | Single line text |
  | `publishDate` | Date |
  | `image` | Content reference (image) |
  | `body` | Multi line text, rich text |

## Rendered page

Default content: `h1` title, summary, author, image, rich-text body; then a
`metadata` block (Title, Description, Image, Author, Published Time).
Relative image paths are made absolute with the publish host (`relativeURLPrefix`),
and links to `/content/midwives/...` pages are rewritten with the site mapping
(`useAEMMapping`).

## Test

Publish an Article fragment from AEM (or preview `/articles/<name>`), then open
`https://main--midwives--bhasakatech.aem.page/articles/<name>`.
