# Журнал запуску аналітики

Підготовлено **2026-10-23**. Це дата підготовки коду та документації. Вхід у GA4 виконано, ресурс і наявний Testing-фільтр перевірено. Фактична публікація нового коду й активація internal-фільтра ще не виконані. Commit / push агентом не виконано.

Перевірений ресурс: **`https://points.gs`**, account `175935550`, property `492459259`, stream **`Points GS`** / `11326397500`, Measurement ID `G-RSXV2Q3WG2`. Країна — Україна; Reporting time zone у UI 2026-10-23 — **`(GMT+03:00) час: Україна`**, перевірено без зміни налаштувань.

| Етап | Фактична дата / стан | Що зафіксувати після виконання |
| --- | --- | --- |
| Код та інструкція | Підготовлено 2026-10-23 | `js/analytics.js`, `docs/analytics.md` |
| Реліз GitHub Pages | Очікує push / релізу користувача | Commit, завершений deployment, дата й часовий пояс |
| Перші події `play_store_click` / `article_engaged` після релізу | Не підтверджено | Production DebugView / Realtime, параметри |
| Internal filter Testing | Наявний фільтр перевірено 2026-10-23; залишено Testing | `Internal Traffic`, Exclude, `traffic_type` exactly matches `internal`; без дублювання |
| Позначений / чистий браузери | Не підтверджено | Test data filter name лише у внутрішнього |
| Internal filter Active | Не активовано цією підготовкою | Дата, перевірка перед активацією, хто підтвердив |
| `play_store_click` key event | Створено й перевірено 2026-10-23 | Create with code, без no-code правила, Once per event, без грошової вартості; стандартну purchase залишено |
| Custom dimensions | Створено й таблицю перевірено 2026-10-23 | Сім Event-scope: page_language, page_type, article_id, link_location, asset_type, form_id, network |
| Звіт ефективності | `Points — ефективність сайту` збережено 2026-10-23, ID 16187758615 | sessions, totalUsers, session key event rate; точний URL додає Session source / medium + Landing page із query string |
| Play-вибір / comparison | Точний URL збережено 2026-10-23; базовий report після reopen скидає All events | [Точний вигляд у документації](analytics.md#збережений-detail-report-вибір-події-перевіряється-при-відкритті); comparison 16187805052, CONTAINS play_store_click, замінити на EXACT після перших даних |
| Колекція звіту ефективності | Опубліковано 2026-10-23: Points — сайт, ID 16187742679 | Тема Ефективність; навігація відкриває report 16187758615 |
| Звіт читачів | Збережено й опубліковано 2026-10-23, Points — залучення статей, ID 16187635868; навігацію перевірено | Article ID + Page language; Total users, Event count; постійний regex ^article_engaged$; лише All users comparison; last28Days / lastPeriod |
| Дати звіту | Перевірено у picker і заголовку 2026-10-23 | 25 Sep–22 Oct 2026 проти 28 Aug–24 Sep 2026; last28Days / lastPeriod, сьогодні виключено |
| Search Console ↔ GA4 | Зв'язок створено й перевірено 2026-10-23 | Domain points.gs → Points GS / 11326397500; дата в таблиці GA4 — 23 Oct 2026 |
| Колекція Search Console | Уже видима після зв'язування; перевірено 2026-10-23, додаткової публікації не було | Queries і Google Organic Search Traffic відкрито; історичні clicks, impressions, CTR, average position наявні |
| Часовий пояс GA4 | Перевірено read-only 2026-10-23 | Country Україна; Reporting time zone `(GMT+03:00) час: Україна`; без зміни налаштувань чи припущень про IANA |
| Початок чистого порівнюваного періоду | Ще не визначено | Найпізніша з дат релізу, key event і перевіреної активації internal-фільтра |

## Локальна перевірка 2026-10-23

Локальні докази налаштувань кабінету: `.tmp/analytics-proof/custom-dimensions.jpg`, `.tmp/analytics-proof/play-key-event.jpg`, `.tmp/analytics-proof/search-console-link.jpg`, `.tmp/analytics-proof/search-queries.jpg`, `.tmp/analytics-proof/effectiveness-report.jpg`, `.tmp/analytics-proof/article-report.jpg`. Точні URL обох звітів збережено в `docs/analytics.md` і `docs/analytics-report.json`. Запитану `google_play_click` відхилено через зарезервований префікс; користувач погодив `play_store_click`. Надходження нових production-подій ще не підтверджено.

- Усі дев'ять локальних наборів перевірок коду пройдено. Серед JS-перевірок: analytics — 28, campaign navigation — 13, contact — 30, article share — 15.
- У браузері локальні alias-переходи й перемикання EN / UK зберігають UTM та internal-параметри; динамічне перемикання головної також зберігає UTM.
- На ширині 390 і 1440 px горизонтального переповнення не виявлено. Локальний сайт не завантажував робочий Google tag.

Ці результати підтверджують локальну поведінку. Залишилися публікація нового коду й фіксація її дати, production accept / reject / withdraw та перевірка подій, заміна comparison CONTAINS на EXACT після перших даних і перевірка Testing-фільтра перед Active. `Internal Traffic` залишається Testing до нового релізу й перевірки позначеного / звичайного трафіку протягом 24–36 годин; Active не ввімкнено.

Перші 28 завершених днів нових подій дадуть базову лінію. Для повного порівняння 28 проти попередніх 28 потрібні два порівнювані періоди. Не замінюйте відсутню історію нулями й не прирівнюйте старі `article_read` (90%) до нових `article_engaged` (50%).

Оновлюйте стани лише після реальної перевірки. Запланована дата релізу не є фактичною датою запуску.
