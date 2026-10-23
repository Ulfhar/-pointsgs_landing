# Аналітика points.gs

Підготовлено **2026-10-23**. Контролер — `js/analytics.js`, робочий GA4 Measurement ID — `G-RSXV2Q3WG2`. Вхід у GA4 виконано; перевірено ресурс `https://points.gs` (Property ID `492459259`), обліковий запис `175935550`, вебпотік `Points GS` (`11326397500`). Публікація нового коду й завершення решти налаштувань ще не підтверджені. Реальні дати й докази записуються в [журнал запуску](analytics-launch.md).

## Сім пунктів: поточний стан

| Пункт | Стан | Що ще потрібно |
| --- | --- | --- |
| Єдине підключення GA4 | Спільний контролер та ID на актуальних сторінках | Push / реліз користувача й перевірка production |
| Чистий трафік | Блокування GA4 поза production; браузерна позначка; наявний `Internal Traffic` у Testing підтверджено | Після релізу перевірити internal / звичайний браузер, потім активувати |
| Переходи Google Play | `play_store_click` погоджено й створено як key event 2026-10-23; попереднє ім'я збережено | Production-перевірка після релізу |
| Залучені читачі | `article_engaged`: 30 активних секунд + 50% тексту; сім Event-scope dimensions створено | Production-перевірка після релізу |
| Звіт ефективності | Обидва звіти опубліковано у `Points — сайт`; збережено точні вигляди Play та читачів | Базовий Play-report скидає вибір на All events; production-звірка обох подій ще потрібна |
| Search Console | Domain `points.gs` зв'язано з `Points GS`; обидва звіти видимі й заповнені історичними даними 2026-10-23 | Нові дані після релізу перевіряються окремо |
| Кампанії та дата запуску | UTM-схема, журнал і правила порівняння | Реальний реліз, фактична дата чистого періоду |

Commit / push у цій роботі не виконуються. Дата підготовки не є датою початку збору нових подій.

## Production та власні браузери

Робочий Google tag завантажується лише на **HTTPS `points.gs` або `www.points.gs`** після згоди CookieYes на Analytics. Localhost, IP-адреси, staging і сторонні домени не надсилають запити до робочого GA4. Окремий тестовий Measurement ID не надано; локальні перевірки імітують зовнішні сервіси.

Для власного браузера відкрийте:

```text
https://points.gs/?analytics_internal=1
```

Позначка зберігається у localStorage для цього браузера й origin та діє на наступних сторінках. Інший профіль, пристрій або `www.points.gs` позначаються окремо. `?analytics_internal=0` вимикає режим; очищення даних сайту також прибирає позначку.

`?analytics_debug=1` вмикає DebugView і робить **поточне відкриття** внутрішнім без постійного збереження прапорця. Для тривалих перевірок:

```text
https://points.gs/?analytics_internal=1&analytics_debug=1
```

Контролер встановлює `traffic_type=internal` на рівні Google tag до першого перегляду, включаючи автоматичні події. IP-адреси для цього механізму не потрібні. Позначка сама не виключає дані зі звітів: потрібен фільтр. [Область дії параметрів Google tag](https://developers.google.com/tag-platform/gtagjs/reference#parameter_scope).

## Фільтр internal: Testing → перевірка → Active

У **Admin → Data collection and modification → Data filters** уже є фільтр **`Internal Traffic`**: **Exclude**, `traffic_type` **exactly matches `internal`**, стан **Testing**. Це перевірено в кабінеті 2026-10-23; фільтр залишено без дублювання чи перейменування. Для редагування потрібен Editor / Administrator. IP-правила для браузерної позначки не потрібні.

1. У позначеному браузері дайте згоду Analytics, відкрийте сторінку й натисніть Play. Перевірте `traffic_type=internal` у `page_view`, `play_store_click` і доступних автоматичних подіях через DebugView / запити.
2. В Explore → Free form додайте Rows: **Test data filter name**, **Event name**; Values: **Event count**. Для цих подій очікується `Internal Traffic`. Застосування Testing може тривати **24–36 годин** після надходження потрібних production-подій.
3. Повторіть дії зі згодою у чистому непозначеному профілі. Його події не повинні мати цієї назви фільтра. Відсутність подій без згоди перевіряє згоду, а не internal-фільтр.
4. Лише після підтвердження обох результатів перемкніть у **Active**, запишіть дату й доказ. Якщо результат не підтверджено, залиште Testing.

**Active назавжди виключає майбутні події, що збігаються з фільтром, з GA4 і BigQuery. Минулі дані не очищуються.** У Testing дані збережені; для тимчасового аналізу зовнішнього трафіку виключайте відповідне Test data filter name у Explore. [Фільтри й перевірка Google](https://support.google.com/analytics/answer/10104470?hl=en).

## Події

| Подія | Умова / значення |
| --- | --- |
| `play_store_click` | Клік посилання гри в Google Play; `page_location`, `link_url`, `page_language`, `link_location`. Перехід у магазин, не встановлення. |
| `article_engaged` | Після згоди: ≥30 активних секунд і досягнуто ≥50% тексту; один раз за відкриття статті. Таймер працює лише у видимій вкладці з фокусом, поки текст є у viewport. |
| `share` | Успішне копіювання / системне поширення; `method`, `content_id`, `content_type=article`. Скасування не рахується. |
| `share_click` | Натискання поширення у соцмережі; намір, не підтвердження публікації. |
| `social_click` | Перехід до профілю студії / гри; `network`. |
| `press_asset_download` | Клік пресматеріалу; `asset_type`, `file_name`, `link_location`. Не підтверджує завершення завантаження. |
| `generate_lead` | Лише підтверджений успіх Formspree; `form_id`. |
| `contact_error` | Помилка надсилання форми; `form_id`, без вмісту звернення. |
| `contact_click` | Клік `mailto:`; `link_location`, намір написати. |

Спільні параметри — `page_language`, `page_type`, для статей — `article_id`. Контролер очищує налаштовані `page_location` / `page_referrer` від фрагментів і довільних параметрів; стандартні UTM залишає у `page_location`. Власні події не передають текст форми чи email.

Назву `play_store_click` збережено за вибором користувача: попередня історія цієї події залишається під тим самим ім'ям. Додано контекст кнопки й internal-фільтрацію, тому порівняння до / після цих змін має обмеження. Паралельного надсилання `google_play_click` немає. `article_read` більше не надсилається: нова `article_engaged` має поріг 50% замість 90%; ці ряди не можна механічно склеювати. Відсутність старих даних не дорівнює нульовому інтересу.

## Згода та автоматичні вимірювання

Використовується CookieYes `e6ba3bfedc57c067fa59e14b`. До згоди Google tag не завантажується, дії не відкладаються для надсилання після згоди. Відкликання припиняє наступні відправлення. GA4 вимірює лише доступну за згодою аудиторію.

CookieYes раніше відкривався на `https://points.gs/devlog.html`; на localhost повідомляв про інший зареєстрований домен. Це не перевірка нового релізу. Реальні accept / reject / withdraw перевіряються на points.gs після публікації.

У **Admin → Data streams → вебпотік → Enhanced measurement → налаштування** для контрольованих подій вимкніть **Outbound clicks**, **File downloads**, **Site search**, **Form interactions**. Інакше автоматичні події можуть дублювати дії й передавати власні повні `link_url` / пошукові / формові параметри поза allowlist контролера. Не створюйте `generate_lead` із `form_submit` і не підсумовуйте автоматичні кліки з власними. [Enhanced measurement](https://support.google.com/analytics/answer/9216061?hl=en).

`send_page_view: false` керує початковим переглядом; вимірювання змін історії браузера налаштовується окремо. Сайт використовує звичайні HTML-переходи.

## Key event і custom dimensions

**Перевірка кабінету 2026-10-23:** GA4 відхилив запитану `google_play_click` під час Create with code: «Введені дані починаються із зарезервованого префікса. Виберіть іншу назву.» Після цього користувач явно погодив **`play_store_click`**, щоб зберегти попереднє ім'я та історію. У коді й звітах використовується лише ця назва. [Правила назв Google](https://support.google.com/analytics/answer/13316687?hl=en).

**Виконано 2026-10-23:** `play_store_click` створено через **Create event → Create with code** як key event, без no-code правила та без грошової вартості, метод підрахунку — **Once per event**. Стан підтверджено в таблиці; стандартну `purchase` залишено. Сповіщення про ще не виявлений потік / нові дані потребує перевірки після релізу й не є підтвердженням надходження подій. Не створюйте ще одне правило копіювання автоматичного `click`. Позначення не перераховує минуле. [Ключові події](https://support.google.com/analytics/answer/13128484?hl=en).

`generate_lead` — окрема можлива ключова ціль. У звіті Play обирайте лише `play_store_click`, а не All events. `article_engaged` оцінюється окремо.

**Виконано 2026-10-23:** у Custom definitions створено й перевірено сім вимірів зі **Scope: Event**: Page language / `page_language`, Page type / `page_type`, Article ID / `article_id`, Link location / `link_location`, Asset type / `asset_type`, Form ID / `form_id`, Network / `network`. Для `page_location`, `link_url`, `method`, `content_id`, `content_type`, `file_name` використовуйте готові виміри. Для internal-фільтра власний вимір `traffic_type` не потрібен. [Власні виміри](https://support.google.com/analytics/answer/14239696?hl=en).

## Збережений звіт «Ефективність сайту»

| Колонка | Визначення |
| --- | --- |
| Джерело / канал | **Session source / medium**, джерело цього сеансу |
| Вхідна сторінка | **Landing page**, перший перегляд у сеансі, без query string |
| Сеанси | Усі зовнішні сеанси рядка |
| Користувачі | **Total users**, унікальні користувачі рядка |
| Сеанси з Play | Сеанси з хоча б однією `play_store_click` |
| Частка з Play | Сеанси з Play / усі сеанси того самого рядка |

Два кліки за сеанс — один сеанс з Play. Кількість кліків і сума всіх key events не є цією метрикою. Унікальних користувачів не підсумовують між рядками.

### Надійне збережене Explore

У **Explore → Blank / Free form** створіть `Ефективність сайту`:

1. Dimensions: **Session source / medium**, **Landing page**, **Event name**, **Article ID / Page path**, **Test data filter name**. Metrics: **Sessions**, **Total users**, **Event count**.
2. Вкладка `Джерела та входи`: Rows — Session source / medium, Landing page; Values — Sessions, Total users.
3. Segment comparisons — **All sessions** і **Session segment** `Сеанси з Google Play`: Include sessions when **Event name exactly matches play_store_click**. Session segment зберігає весь відповідний сеанс; User segment охопив би також інші сеанси цих людей. [Сегменти](https://support.google.com/analytics/answer/9304353?hl=en).
4. **Не ставте Event name=play_store_click у Filters усієї вкладки**: це зіпсує знаменник. Sessions сегмента Play — чисельник; Sessions сегмента All sessions — знаменник. У Testing однаково виключіть `Internal Traffic` з обох; Active уже прибирає майбутній internal.
5. Якщо picker дозволяє, додайте **Session key event rate (play_store_click)** для All sessions. Загальна Session key event rate включає всі ключові події. Якщо окрема метрика недоступна в Explore, залиште обидва counts і обчисліть частку в експорті; не припускайте наявності збереженої формули між колонками сегментів.
6. Вкладка `Читачі статей`: Rows — Article ID / Page path; Values — **Total users**, Event count; Filter — **Event name exactly matches article_engaged**. Тут event filter доречний: потрібні унікальні читачі конкретної події без конверсійного знаменника. Event count не замінює Total users.

**Збережено й опубліковано 2026-10-23:** [**`Points — залучення статей`**][article-report], ID **`16187635868`**, у колекції `Points — сайт`, тема `Ефективність`; відкриття з навігації перевірено. Основний вимір — Article ID, вторинний — Page language; метрики — **Total users** і Event count. Постійний фільтр **Event name MATCHES REGEX `^article_engaged$`** підтверджено після повторного відкриття. Залишено лише All users comparison, без Play-фільтра; період last28Days / lastPeriod. Поточний нуль нової події до релізу очікуваний і не означає відсутності читачів.

[article-report]: https://analytics.google.com/analytics/web/?pli=1#/a175935550p492459259/reports/explorer?params=_u..nav%3Dmaui%26_u.dateOption%3Dlast28Days%26_u.comparisonOption%3DlastPeriod%26_u..comparisons%3D%5B%7B%22savedComparisonId%22:%2211326407057%22,%22name%22:%22%D0%A3%D1%81%D1%96%20%D0%BA%D0%BE%D1%80%D0%B8%D1%81%D1%82%D1%83%D0%B2%D0%B0%D1%87%D1%96%22,%22isEnabled%22:true,%22filters%22:%5B%5D,%22systemDefinedSavedComparisonType%22:8,%22isSystemDefined%22:true%7D%5D%26_r.explorerCard..seldim%3D%5B%22customDimensionsGroup2Slot03%22,%22customDimensionsGroup2Slot01%22%5D%26_u..built_comparisons_enabled%3Dtrue&collectionId=16187742679&discardConfirmed=true&ruid=9220AE3E-01BC-43D1-8C8B-9E15CCD47769&r=16187635868

### Збережений detail report: вибір події перевіряється при відкритті

**Збережено й опубліковано 2026-10-23:** detail report **`Points — ефективність сайту`**, ID **`16187758615`**, у колекції **`Points — сайт`** (`16187742679`), тема `Ефективність`. Метрики — Sessions, Total users, Session key event rate.

**Обмеження перевірено повторним відкриттям:** базовий report скидає вибір `play_store_click` на **All events**. Користуйтеся [точним збереженим виглядом][play-report], який містить вибір `play_store_click`, Session source / medium + Landing page, All sessions і comparison **`Points — натискання Play Store`** (`16187805052`). Не називайте частку All events часткою Play.

Comparison наразі використовує case-sensitive **Event name CONTAINS `play_store_click`**: picker точного значення ще не знаходить production-подію. Після надходження даних замініть умову на **EXACT**. Зараз у звіті окремі Sessions — **159** для всіх і **0** для comparison; інтерпретацію чисельника ще потрібно звірити з Session segment у Explore після релізу. Native comparison не названо session-scoped segment. Поточний точний вигляд використовує Landing page **із query string**, тому UTM-варіанти можуть розділяти один шлях на рядки; цільова специфікація / Explore вище використовує Landing page без query. [Редагування звіту](https://support.google.com/analytics/answer/10445879?hl=en).

Трактування **Sessions** у event comparison як сеансів із кліком — обґрунтований висновок: Google наводить [приклад eventName-фільтра із Sessions](https://developers.google.com/analytics/devguides/reporting/data/v1/basics), а кількість сеансів [оцінює за унікальними session IDs](https://support.google.com/analytics/answer/9191807?hl=en). Це не означає, що фільтр зберігає весь сеанс для інших метрик: engagement time та інші показники comparison не прирівнюйте до Session segment. Production-звірка чисельника лишається кроком запуску.

[play-report]: https://analytics.google.com/analytics/web/?pli=1#/a175935550p492459259/reports/explorer?params=_u..nav%3Dmaui%26_u.dateOption%3Dlast28Days%26_u.comparisonOption%3DlastPeriod%26_r.explorerCard..seldim%3D%5B%22sessionSourceMedium%22,%22landingPage%22%5D%26_u..built_comparisons_enabled%3Dtrue%26_u..comparisons%3D%5B%7B%22savedComparisonId%22:%2211326407057%22,%22name%22:%22%D0%A3%D1%81%D1%96%20%D0%BA%D0%BE%D1%80%D0%B8%D1%81%D1%82%D1%83%D0%B2%D0%B0%D1%87%D1%96%22,%22isEnabled%22:true,%22filters%22:%5B%5D,%22systemDefinedSavedComparisonType%22:8,%22isSystemDefined%22:true%7D,%7B%22savedComparisonId%22:%2216187805052%22,%22hasCustomName%22:true,%22name%22:%22Points%20%E2%80%94%20%D0%BD%D0%B0%D1%82%D0%B8%D1%81%D0%BA%D0%B0%D0%BD%D0%BD%D1%8F%20Play%20Store%22,%22isEnabled%22:true,%22filters%22:%5B%7B%22fieldName%22:%22eventName%22,%22evaluationType%22:3,%22expressionList%22:%5B%22play_store_click%22%5D,%22isCaseSensitive%22:true%7D%5D,%22systemDefinedSavedComparisonType%22:0,%22isSystemDefined%22:false%7D%5D%26_r.explorerCard..columnFilters%3D%7B%22sessionConversionRate%22:%22play_store_click%22%7D&collectionId=16187742679&discardConfirmed=true&ruid=a162be53-70f8-481d-8396-d9d8ca40a28b&r=16187758615

[Локальна специфікація](analytics-report.json) також описує точні шість колонок через Data API: `sessions`, `totalUsers`, `sessionKeyEventRate:play_store_click`, без Event name filter. Сеанси з Play = Sessions × ця частка. Потрібні справжній числовий Property ID, доступ, зареєстрована key event і перевірка сумісності полів. JSON сам не створює звіт у GA4. [Поля Data API](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema#key_event_rate_metrics_for_each_key_event).

### Період

Точний вигляд зберігає **last28Days → lastPeriod**. У datepicker і заголовку 2026-10-23 перевірено **2026-09-25–2026-10-22** проти **2026-08-28–2026-09-24**: сьогодні виключено. Це 28 завершених днів проти попередніх 28. У властивостях ресурсу read-only підтверджено країну **Україна** й Reporting time zone **`(GMT+03:00) час: Україна`**; налаштування не змінювалися. Це значення, показане інтерфейсом на дату перевірки, без припущення про внутрішній IANA-ідентифікатор.

Початок чистого періоду — найпізніша з підтверджених дат: реліз нових подій, ввімкнення `play_store_click` як key event, активація перевіреного internal-фільтра. До накопичення 28 днів період неповний. Порівняння з ранішим часом позначайте як обмежене. Для частки показуйте різницю у процентних пунктах; для сеансів — кількість і відносну зміну.

## Search Console

Потрібні **Editor у GA4** та **verified owner у Search Console**. Використовуйте наявний підтверджений ресурс points.gs. Якщо його немає: Domain property `points.gs` → справжній DNS-запис із кабінету → додавання у DNS → Verify. Запис не вигадується й залишається після перевірки. [Підтвердження власності](https://support.google.com/webmasters/answer/9008080?hl=en).

**Виконано 2026-10-23:** Domain property **`points.gs`** зв'язано з вебпотоком **`Points GS` / `11326397500`**; створення зв'язку підтверджено в таблиці GA4. Колекція Search Console уже видима в Reports; обидва звіти відкрито й перевірено з історичними даними, тому додаткова публікація не знадобилася. Перевірити зв'язок можна через **Admin → Product links → Search Console Links**; повторно створювати його не потрібно. [Зв'язування й обмеження](https://support.google.com/analytics/answer/10737381?hl=en).

- **Google Organic Search Queries** — запити, покази, кліки, CTR, позиція. Не можна довільно додати GA4 джерела, `article_engaged` чи Play-конверсії до рядка пошукового запиту.
- **Google Organic Search Traffic** — landing pages із пошуковими й сумісними GA4 метриками; додаткові сумісні виміри — Country і Device. Play-ефективність органічних сеансів дивіться окремо у звіті з Session source / medium = `google / organic`.

Це не зв'язок «конкретний запит → людина → встановлення». Пошукові дані мають затримку близько 48 годин. У **Sitemaps** надішліть [наявну карту](https://points.gs/sitemap.xml), якщо її ще немає. [Sitemaps](https://support.google.com/webmasters/answer/7451001?hl=en).

## Єдина UTM-схема

Мітки — лише на зовнішніх посиланнях **на сайт**. Значення малими латинськими літерами, слова через `_`; одна кампанія має однакову назву на всіх платформах.

| Поле | Шаблон / приклад |
| --- | --- |
| `utm_source` | `tiktok`, `youtube`, `x`, `instagram`, `newsletter` |
| `utm_medium` | `social` — звичайний допис; `paid_social` — оплачена соцреклама; `email` — розсилка |
| `utm_campaign` | `{theme}_{yyyy_mm}` / `{event}_{yyyy}`: `cozy_launch_2026_10`, `halloween_2026` |
| `utm_content` | `{placement}_{creative}`: `bio_main`, `description_gameplay`, `post_cauldron_01` |

```text
https://points.gs/?utm_source=tiktok&utm_medium=social&utm_campaign=halloween_2026&utm_content=bio_main
https://points.gs/?utm_source=youtube&utm_medium=social&utm_campaign=halloween_2026&utm_content=description_gameplay
https://points.gs/uk/pillar_1.html?utm_source=x&utm_medium=social&utm_campaign=halloween_2026&utm_content=post_cauldron_01
```

Не ставте UTM на внутрішні переходи чи Play-кнопки: є `link_location`. Не включайте імена / email у мітки. У звіті — **Session source / medium**, не First user source / medium. [UTM у GA4](https://support.google.com/analytics/answer/10917952?hl=en).

## Оновлення та перевірка запуску

Після змін контролера / генерації статей із кореня репозиторію, з фактичною датою:

```text
python tools/build_blog.py --modified-date YYYY-MM-DD
python tools/sync_analytics.py
node tests/check_analytics.js
node tests/check_contact_analytics.js
node tests/check_campaign_navigation.js
node tests/check_article_share.js
```

Користувач публікує перевірені зміни звичайним релізом GitHub Pages. Після цього у внутрішньому браузері перевіряються:

1. **Reject:** немає Google tag / GA-запитів; дії до згоди не відтворюються після неї.
2. **Accept:** один `page_view`; `play_store_click` має адресу сторінки, Play, мову, місце кнопки; `google_play_click` / `article_read` не надсилаються.
3. **Стаття:** до 30 активних секунд або 50% тексту події немає; при обох умовах — одна `article_engaged`. Прихована вкладка, втрата фокусу й відсутність тексту у viewport не накопичують час.
4. **Withdraw:** наступні події припиняються. Перевірити EN і UK.
5. **Середовища:** localhost / staging навіть зі згодою та debug не завантажують робочий GA4. Debug / internal у production мають `traffic_type=internal`, чистий звичайний браузер — ні.
6. **Форми:** автоматичні тести підміняють Formspree; справжні звернення не надсилаються.
7. **Кабінет:** підтвердити Testing, потім Active, key event, dimensions, збережений звіт, Search Console; записати фактичні дати. [DebugView](https://support.google.com/analytics/answer/7201382?hl=en).

GA4 вимірює переходи до Play. Встановлення й атрибуція встановлень потребують даних застосунку / Play Console.
