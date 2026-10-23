# Журнал запуску аналітики

Підготовлено **2026-10-23**. Користувач виконав push; цього ж дня новий код підтверджено у production й отримано перші тестові події DebugView. Commit / push агентом не виконано. `Internal Traffic` залишається Testing; Active ще не ввімкнено.

Перевірений ресурс: **`https://points.gs`**, account `175935550`, property `492459259`, stream **`Points GS`** / `11326397500`, Measurement ID `G-RSXV2Q3WG2`. Країна — Україна; Reporting time zone у UI 2026-10-23 — **`(GMT+03:00) час: Україна`**, перевірено без зміни налаштувань.

| Етап | Фактична дата / стан | Що зафіксувати після виконання |
| --- | --- | --- |
| Код та інструкція | Підготовлено 2026-10-23 | `js/analytics.js`, `docs/analytics.md` |
| Реліз GitHub Pages | Вміст production перевірено 2026-10-23 після push користувача | HEAD 99ea8e1b5a108f925b887799e9daebe70ac16e3a; analytics v201d46a91e17, locale v949e401ce8ae; окремий статус Actions не підтверджено |
| `page_view` / `play_store_click` після релізу | Отримано у production DebugView 2026-10-23 | Пізніший знімок: page_view 3, play_store_click 2 рівно після EN hero + UK hero; клік після відмови не збільшив Play |
| `article_engaged` після релізу | Позитивний тест ще не підтверджено | 57.9% геометрії + 35 с у фоні — без події; автоматична спроба активного фокусу не дала підтвердження, очікується ручний тест |
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

Локальні докази налаштувань кабінету: `.tmp/analytics-proof/custom-dimensions.jpg`, `.tmp/analytics-proof/play-key-event.jpg`, `.tmp/analytics-proof/search-console-link.jpg`, `.tmp/analytics-proof/search-queries.jpg`, `.tmp/analytics-proof/effectiveness-report.jpg`, `.tmp/analytics-proof/article-report.jpg`. Точні URL обох звітів збережено в `docs/analytics.md` і `docs/analytics-report.json`. Запитану `google_play_click` відхилено через зарезервований префікс; користувач погодив `play_store_click`.

- Усі дев'ять локальних наборів перевірок коду пройдено. Серед JS-перевірок: analytics — 28, campaign navigation — 13, contact — 30, article share — 15.
- У браузері локальні alias-переходи й перемикання EN / UK зберігають UTM та internal-параметри; динамічне перемикання головної також зберігає UTM.
- На ширині 390 і 1440 px горизонтального переповнення не виявлено. Локальний сайт не завантажував робочий Google tag.

## Production-перевірка 2026-10-23

- Опублікований DOM підключає analytics `201d46a91e17` і locale `949e401ce8ae`, що відповідає локальному HEAD `99ea8e1b5a108f925b887799e9daebe70ac16e3a` (`analytics`, commit time `2026-10-23 12:30:56 +03:00`). Час commit не є часом завершення deployment; окремий статус GitHub Actions не підтверджено.
- CookieYes Preferences — `position: fixed`, без горизонтального переповнення на 1440 px. Reject All + reload — Google scripts відсутні. Accept All — додано gtag `G-RSXV2Q3WG2`.
- Після одного hero-кліка у початковому DebugView: `page_view=1`, `session_start=1`, `play_store_click=1`. Для Play перевірено `traffic_type=internal`, `link_location=hero`, `page_language=en`, повний app URL і `page_location=https://points.gs/` без debug / internal query. `page_view` також має `traffic_type=internal`.
- Тестовий production-браузер постійно позначено через `analytics_internal=1`. Alias-перехід news9 зберіг усі кампанійні UTM у правильному цільовому URL.
- UK-головна після динамічного перемикання: `lang=uk`, viewport 390×844 без горизонтального переповнення. CookieYes fixed-модальне вікно має rect 375×844 у (0, 0), уміщується у viewport.
- Після withdraw + reload та EN → UK Google script відсутній до повторної згоди. Подальший DebugView має `page_view=3` (EN home, EN article, UK home) і рівно `play_store_click=2` (по одному EN / UK hero). Відхилений hero-клік перед повторною UK-згодою не збільшив лічильник; для UK Play підтверджено `page_language=uk`.
- На статті досягнуто 57.9% геометрії; після 35 секунд у фоновій вкладці `article_engaged` не з'явилася. Автоматична спроба 35 активних секунд також не підтвердила подію; справжній фокус під автоматизацією не встановлено, очікується ручний тест. Позитивний результат статті не заявляється.
- Повторна перевірка EXACT picker показала лише шість історичних назв без Play попри DebugView. Незбережену спробу редагування скасовано; збережений CONTAINS залишається чинним до обробки нових подій.
- Same-page withdraw перевірено на UK: після дозволеної hero-події натиснуто CookieYes Reject All, потім один seasonal CTA без reload. Понад дві хвилини потому, у знімку DebugView 12:49, залишилися `play_store_click=2`, `page_view=3`, `session_start=1`; додаткового Play немає.
- UK desktop 1440×1000: `lang=uk`, немає горизонтального переповнення, hero-посилання перевірено. EN mobile 390×844: `lang=en`, немає переповнення й Google script після відмови. Разом перевірено layout усіх чотирьох пар EN / UK × desktop / mobile; позитивні Play-події — лише EN desktop і UK mobile.

Докази: `.tmp/analytics-proof/production-cookie-desktop.jpg`, `.tmp/analytics-proof/production-play-debug.jpg`, `.tmp/analytics-proof/production-pageview-debug.jpg`, `.tmp/analytics-proof/production-cookie-mobile.jpg`, `.tmp/analytics-proof/production-play-uk-debug.jpg`, `.tmp/analytics-proof/production-uk-desktop.jpg`, `.tmp/analytics-proof/production-en-mobile.jpg`.

Залишилися позитивний ручний article-тест і дедуплікація (відповіді користувача ще немає), заміна comparison CONTAINS на EXACT після обробки подій і перевірка позначеного / чистого браузера через Test data filter name перед Active. Обробка Testing може тривати 24–36 годин; Active не ввімкнено. Повний чистий порівнюваний період ще не почався.

Перші 28 завершених днів нових подій дадуть базову лінію. Для повного порівняння 28 проти попередніх 28 потрібні два порівнювані періоди. Не замінюйте відсутню історію нулями й не прирівнюйте старі `article_read` (90%) до нових `article_engaged` (50%).

Оновлюйте стани лише після реальної перевірки. Запланована дата релізу не є фактичною датою запуску.
