# Partnerships handoff

Prepared and checked locally on **23 October 2026**. No commit, push, or deployment was performed by the agent.

## Page and source files

- Entry: `https://points.gs/partners`; the directory URL and canonical are `https://points.gs/partners/`.
- Generated page: `partners/index.html`. Edit `templates/partners.html`, rather than the generated page.
- Styles: `css/partners.css`; navigation uses the existing shared header and footer.
- PDF source: `tools/build_project_overview.py`; public download: `public/downloads/lumen-grove-project-overview.pdf` (one A4 page, approximately 700 KB).
- The page contains the full project facts, partnership focus, current media, Google Play link, direct business email, and an embedded partnership form in the “Start with a conversation” section. The hero's Request pitch deck CTA links directly to that section without opening another page.
- Unique title, H1, description, canonical, Open Graph/Twitter metadata, structured data, and sitemap entry are included. The page is English only.

Regenerate in this order from the repository root; Python needs ReportLab and Pillow for the first command:

```powershell
python tools/build_project_overview.py
python tools/build_partners.py
python tools/build_blog.py --modified-date 2026-10-23
python tools/sync_analytics.py
```

Keep the PDF's **last game update** date separate from its **prepared** date. The current Android update date is **12 October 2026**, checked on Google Play. Refresh this editorial fact before a later release if the game has changed.

## Approved material and copy

The owner approved reuse of existing gameplay, screenshots and `info@points.gs`, and preparation of the PDF from verified facts. The page and PDF describe a released Android, free-to-play cozy forest farming game made with Unity 2D; iOS is planned. The studio and Bogdan Kagitin attribution use existing site credits. No team size, performance figures, funding requirements, or investment promises have been invented. Obtain the owner's approval before adding financial terms or an investment proposal. Detailed metrics and commercial materials are available on request; the pitch deck itself is not published.

## Contact and consent

The hero's Request pitch deck button scrolls to `#contact`, where the embedded `partnersContactForm` is ready to submit a partnership inquiry. Visitors enter their name, email and message, then select **Send inquiry**. The topic is fixed to `partnership`; there is no redundant topic selector on this dedicated page. The visible business email is `info@points.gs`.

Submission uses the existing shared `js/home-contact.js` controller and Formspree endpoint `https://formspree.io/f/xkjggyon`. Normal submission stays on the Partnerships page for validation, errors and confirmation. A native `POST` action and hidden subject preserve a delivery fallback when JavaScript is unavailable. The homepage keeps its existing form and topic selector.

**The endpoint's actual recipient has not been verified in the Formspree account, and no real email was sent during QA.** The owner chose to verify the recipient later. Confirm the agreed recipient and delivery after deployment. UI success and the successful-submission analytics event occur only after a successful server response. Failed validation, network errors and unsuccessful responses do not emit `partnership_inquiry_submit`. Duplicate submissions are guarded. Form contents and email addresses are not sent as analytics parameters.

The existing analytics consent and internal-traffic rules apply. Standard `page_view` measures page openings; the Partnerships implementation does not send an extra page-view event.

| Event | Trigger | Parameters |
| --- | --- | --- |
| `partnership_contact_click` | The hero's Request pitch deck CTA or a business-email link is clicked | `contact_type` = `form` or `email`; `link_location` = the tagged button placement |
| `project_overview_download` | A project-overview download link is clicked | `contact_type` = `pdf`; `link_location` = the tagged placement |
| `partnership_inquiry_submit` | A partnership form receives a successful server response | `contact_type` = `form`; embedded form: `link_location` = `partners_contact`, `form_id` = `partnersContactForm`; homepage: `link_location` = `home_contact`, `form_id` = `contactForm` |

The embedded submit button does not fire a form-opening click event. A successful inquiry emits the existing `generate_lead` event and one `partnership_inquiry_submit`; validation errors, a failed server response and repeat dispatch do not report success.

The download event measures a click, not proof that a file was saved or read. The existing `play_store_click` continues to measure Google Play clicks separately.

## GA4 report configured

Property: **https://points.gs**, ID **492459259**. Event-scoped **Contact type** (`contact_type`) was registered in custom-dimension slot **08**; existing **Link location** (`link_location`) is in slot **04**.

The saved native detail report **Points — Partnerships**, ID **16188159950**, is published under **Points — сайт → Ефективність**, collection **16187742679**.

- Dimensions: Session source / medium (`sessionSourceMedium`), Session campaign (`sessionCampaignName`), Event name (`eventName`), Contact type (`contact_type`), and Link location (`link_location`). Custom-dimension API names use the `customEvent:` prefix.
- Metrics: Event count (`eventCount`), Total users (`totalUsers`), and Sessions (`sessions`).
- Report filter: Event name matches the anchored regular expression `^(partnership_contact_click|project_overview_download|partnership_inquiry_submit)$`.
- Date view: the last **28 completed days**, compared with the previous 28 days. On 23 October this is **25 September–22 October** versus **28 August–24 September**. Recheck the date selector when reopening the report; the links carry its relative date and comparison state.

Saved views: [source / medium and action](https://analytics.google.com/analytics/web/?pli=1#/a175935550p492459259/reports/explorer?params=_u..nav%3Dmaui%26_u.dateOption%3Dlast28Days%26_u.comparisonOption%3DlastPeriod%26_u..comparisons%3D%5B%7B%22savedComparisonId%22:%2211326407057%22,%22name%22:%22%D0%A3%D1%81%D1%96%20%D0%BA%D0%BE%D1%80%D0%B8%D1%81%D1%82%D1%83%D0%B2%D0%B0%D1%87%D1%96%22,%22isEnabled%22:true,%22filters%22:%5B%5D,%22systemDefinedSavedComparisonType%22:8,%22isSystemDefined%22:true%7D%5D%26_u..built_comparisons_enabled%3Dtrue%26_r.explorerCard..seldim%3D%5B%22sessionSourceMedium%22,%22eventName%22%5D&discardConfirmed=true&ruid=599234A7-CF0C-49BE-BFE7-08E4ED3E6F4A&collectionId=16187742679&r=16188159950), [campaign and action](https://analytics.google.com/analytics/web/?pli=1#/a175935550p492459259/reports/explorer?params=_u..nav%3Dmaui%26_u.dateOption%3Dlast28Days%26_u.comparisonOption%3DlastPeriod%26_u..comparisons%3D%5B%7B%22savedComparisonId%22:%2211326407057%22,%22name%22:%22%D0%A3%D1%81%D1%96%20%D0%BA%D0%BE%D1%80%D0%B8%D1%81%D1%82%D1%83%D0%B2%D0%B0%D1%87%D1%96%22,%22isEnabled%22:true,%22filters%22:%5B%5D,%22systemDefinedSavedComparisonType%22:8,%22isSystemDefined%22:true%7D%5D%26_u..built_comparisons_enabled%3Dtrue%26_r.explorerCard..seldim%3D%5B%22sessionCampaignName%22,%22eventName%22%5D&discardConfirmed=true&ruid=599234A7-CF0C-49BE-BFE7-08E4ED3E6F4A&collectionId=16187742679&r=16188159950).

Because the report filters to these actions, its Sessions metric describes sessions with matching actions, not all site sessions. Do not use that number as the denominator of an overall conversion rate. Newly deployed events and custom dimensions need GA4 processing before populated reports are expected.

## QA and remaining release checks

Completed locally:

- Desktop **1440 px** and mobile **390 px / 320 px**: no horizontal overflow; navigation and contact actions work.
- The Partnerships form is embedded in its contact section; the hero targets `#contact` on the same page. The existing homepage's legacy `contact_topic=partnership#contactForm` links retain their alignment behavior and topic selection for other entry points.
- The new hero-to-form journey was checked at 1440, 390 and 320 px. The mobile section lands approximately 84 px below the top edge, with full-width fields and submit button. Submitting empty fields shows four inline validation errors, keeps the same URL, leaves the success message hidden and permits correction; no real inquiry was sent.
- The actual gameplay file plays on desktop and mobile. Its intrinsic dimensions are **1560×720** and duration is **134.367 seconds**; the display uses the matching aspect ratio.
- The PDF download is byte-identical to the generated artifact. The one-page PDF was rendered and inspected for clipping or overlap; its four URL annotations and text bounds were checked.
- Five Python suites and five JavaScript suites passed; the JavaScript suites cover **136 scenarios**. These include the embedded form's success, validation, server/network failure, retry, rate limiting and duplicate suppression, as well as consent, single click events, page/navigation checks and existing site behavior.
- Indexability declarations, sitemap inclusion and social-preview assets were checked locally. These checks do not establish Google indexing or a successful live URL inspection.

After the owner pushes and the deployment is live:

1. Confirm `/partners` resolves to the intended canonical page, all media/PDF requests succeed, and the preview metadata is present on the live URL.
2. Use Search Console's live URL test to verify crawl/index eligibility; request indexing when appropriate. No live test of the new undeployed page has been claimed.
3. Verify the three new events and their parameters in GA4 DebugView with analytics consent, and check that one action produces one event. Keep the testing browser marked as internal.
4. Confirm the Formspree recipient and perform an authorized delivery check. Ensure the successful-submission event appears only for a successful submission.

## External campaign links

Use lowercase values with underscores. Keep `utm_campaign=partnerships_2026` consistent across channels, and change `utm_content` for different placements or messages. These examples contain no personal identifiers:

```text
https://points.gs/partners/?utm_source=meettomatch&utm_medium=referral&utm_campaign=partnerships_2026&utm_content=profile
https://points.gs/partners/?utm_source=linkedin&utm_medium=social&utm_campaign=partnerships_2026&utm_content=studio_profile
https://points.gs/partners/?utm_source=professional_contacts&utm_medium=email&utm_campaign=partnerships_2026&utm_content=project_intro
```

The owner adds these links to external profiles and professional outreach after publication. Do not add UTM parameters to internal navigation, PDF links or Google Play buttons; action placement is already recorded in `link_location`.
