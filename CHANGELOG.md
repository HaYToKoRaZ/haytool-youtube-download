# Changelog - Release History / Sürüm Günlüğü

This file contains version-based details of improvements, bug fixes, and optimizations made in the HaYTool Youtube Download application.
Bu dosyada, HaYTool Youtube Download uygulamasında yapılan geliştirmeler, hata düzeltmeleri ve optimizasyonlar sürüm bazlı olarak listelenmektedir.

## [9.8.9] - 2026-08-26

### 🐛 Bug Fixes

- **Fix (AppImage/Linux):** `open` modülünden kaynaklanan tarayıcı açılışındaki EACCES ve `Unhandled 'error' event` çökme hatası giderildi. Doğrudan sistemin `xdg-open` komutu kullanıma alındı.

## [9.8.4] - 2026-08-26

### ⚡ Event Loop & Synchronous I/O Fixes (Event Loop ve Senkron Kilitlenme Çözümleri)

- **Database Writes Unblocked:** Overhauled `writeDb` in `server/database.js` to use fully asynchronous `fs.promises.writeFile` and `fs.promises.rename` operations. Replaced the synchronous busy-wait (`while (Date.now() < waitTill)`) with a non-blocking `await new Promise(resolve => setTimeout(resolve, 20))`, effectively eliminating backend event-loop freezing during heavy writes. (Veritabanı diske yazılırken oluşan anlık sunucu kilitlenmeleri (donmaları), tamamen asenkron dosya sistemi ve bekleme mantığı kullanılarak giderildi.)
- **Asynchronous Config Saves:** `saveSettingsToIni`, `saveChannelsToIni`, and `saveCategoriesToIni` now utilize `await writeIni` with asynchronous file operations. (Kanallar, kategoriler ve ayarlar .ini dosyalarına kaydedilirken oluşan arayüz donmaları çözüldü.)
- **Gist & Stream Async IO:** Refactored `server/routes/gist.js`, `server/routes/iptv.js`, and `server/routes/streams.js` to use `fs.promises.readFile` and `writeFile`, preventing the entire server from locking up when users fetch Gist backups or when subtitle files are generated/translated. (Gist yedekleme, IPTV önbelleği ve Altyazı çeviri/açıklama servislerindeki bloklayıcı senkron işlemler asenkron yapıya çevrildi.)

## [9.8.3] - 2026-08-26

### 🚀 HaYTooLPlayer.exe Background Process Fix & UI Performance (Arka Plan Kilitlenme ve Arayüz Optimizasyonu)

- **Cookie Refresh Throttle (Çerez Tazeleme Sınırı):** The `triggerSilentCookieRefresh` function in `settings.js` now has a 10-minute cooldown. This prevents `HaYTooLPlayer.exe` from spawning rapidly in the background and locking up the user's system CPU/RAM when YouTube cookies are invalid. (Çerez yenileme işlemine 10 dakikalık bekleme süresi eklendi. Böylece Görev Yöneticisinde sürekli `HaYTooLPlayer.exe` açılıp bilgisayarı kasması sorunu çözüldü.)
- **Non-blocking YouTube Watch Sync (Asenkron YouTube İzlendi İşaretleme):** In `history.js`, the `markVideoWatchedOnYouTube` operation during a `DELETE` request is now completely decoupled from the main thread using `setTimeout`, preventing the API from hanging the frontend UI. (Video silindiğinde, YouTube'da izlendi olarak işaretleme işlemi tamamen arka plana atıldı, böylece silme butonuna basıldığında arayüz anında tepki veriyor.)
- **Duplicate Event Listener Removed (Çift Tetiklenen Olay Dinleyicisi Düzeltildi):** Removed a duplicate `confirmDeleteBtn` click listener in `app.js` that was bypassing the optimistic UI updates built in `db-renderer.js` and causing a secondary blocking fetch request. (Silme işlemini iki kez tetikleyen ve arayüzü kilitleyen hata `app.js` içerisinden temizlendi. Optimistik UI tam verimle çalışıyor.)

## [9.8.2] - 2026-08-25

### 🗺️ Comprehensive UI Control Map (Kullanıcı Arayüzü Buton & Kontrol Haritası)

- **UI Button & Action Map (`0nogithub/mapsui.md`):** Created a full, structured UI map documenting all clickable buttons, tabs, modal dialogs, inline player controls, and view toggles across the entire application with their location and purpose. (Uygulamanın tüm sayfalarında, kütüphanesinde, yerleşik oynatıcısında, IPTV modülünde ve modallarında bulunan tüm tıklanabilir butonları ve işlevlerini açıklayan `0nogithub/mapsui.md` rehberi oluşturuldu.)
- **Project Map Updated (`0nogithub/maps.md`):** Linked `mapsui.md` into the local architecture map. (`0nogithub/maps.md` dosyasına yeni harita rehberi eklendi.)

## [9.8.1] - 2026-08-25

### 🐧 Linux (CachyOS) & Unix Uyumluluğu (Linux & Unix Compatibility)

- **Config File Creation (Ayar Dosyası Oluşturma):** Linux ve Unix tabanlı işletim sistemleri (CachyOS vb.) için `configunix.ini` dosyası projeye eklendi. (Added `configunix.ini` file for Linux/Unix systems).
- **Path Adjustments (Dizin Ayarlamaları):** Linux dosya sistemine uyumlu varsayılan yapılandırma şablonu oluşturuldu. Kullanıcının disk yolu bilgisi (mount point) eklendi. (Created default configuration template suitable for Linux filesystems).
- **Sync version:** Sürüm numarası `baslat.sh` dosyasında da güncel v9.8.1 sürümüne eşitlendi. (Version number synced in `baslat.sh` to v9.8.1).

## [9.8.0] - 2026-08-25

### 🚀 Video Deletion Performance Optimization (Video Silme Performans Optimizasyonu)

- **Asynchronous File Deletion (Asenkron Dosya Silme):** The `DELETE /history/:id` and `bulk-delete` routes have been completely rewritten to use Node.js `fs.promises`. Disk operations no longer block the main event loop. (Video silme rotaları asenkron `fs.promises` kullanacak şekilde yeniden yazıldı, I/O işlemleri artık sunucuyu kitlemiyor.)
- **Smart Folder Scanning (Akıllı Klasör Tarama):** Removed redundant fallback scans when the exact file path is known. Fallbacks now correctly use `Set` objects and `Promise.all` for parallel operations. (Gereksiz çift taramalar giderildi, paralel silme ve `Set` ile tekrar engellendi.)
- **`writeDbFast` Optimization (Hızlı Veritabanı Yazımı):** Deletion operations no longer trigger a full INI sync or constant `.bak` file creations (throttle set to 5 minutes). This prevents ~4MB of unnecessary disk writes per deletion. (Silme işlemleri artık INI dosyalarına veya her seferinde yedek dosyasına yazmaz; bu sayede her işlemde yaklaşık ~4MB I/O tasarrufu sağlandı.)
- **Optimistic UI for Deletion (Silme İşleminde İyimser Arayüz):** When deleting a video, the UI instantly removes the card without waiting for the server's disk operations to finish. If an error occurs, the card is safely restored. (Silme işleminde video kartı sunucu yanıtını beklemeden anında arayüzden kaybolur; işlem çok daha akıcı hale getirildi. Hata olursa kart geri gelir.)

## [9.7.3] - 2026-08-25

### 🎚️ Channels Tab Filter Bar Alignment (Kanallar Sekmesi Filtre Çubuğu Hizalaması)

- Unified height and vertical alignment for all items inside `.channel-filters-left` (search box, both filter selects, labels) — they now share a consistent 34px height and are centered on the same baseline. Kanal filtre çubuğunun sol tarafındaki tüm öğeler (arama kutusu, iki filtre seçimi, etiketler) ortak 34px yüksekliğe ve aynı dikey hizalamaya getirildi.

## [9.7.2] - 2026-08-24

### 🎯 Dropdown Positioning Fix & Filter Persistence (Açılır Menü Konumu Düzeltmesi & Filtre Kalıcılığı)

- **Fixed dropdown positioning:** The Library toolbar's `backdrop-filter: blur(10px)` was creating a containing block for `position:fixed` popups — the channel and filter dropdowns opened far away from their triggers (offset by the toolbar's position). Removed it; menus now open exactly below their trigger. Kütüphane araç çubuğundaki `backdrop-filter` değeri `position:fixed` açılır menüler için containing block oluşturuyordu — kanal ve filtre menüleri trigger'ından çok uzakta açılıyordu. Kaldırıldı; menüler artık tam trigger'ın altında açılıyor.
- **Filter chips now persist to configwin.ini:** The 7 quick filter states (Shorts, Live, No-Auto-Download, Not-Downloaded, Live-Processing, Members, Hidden) are now saved to and restored from `configwin.ini` (server-side), so they survive browser storage clears. Hızlı filtre çipleri artık `configwin.ini`'ye kaydedilip oradan geri yükleniyor (sunucu tarafında) — tarayıcı deposu temizlense bile korunur.
- **Channel filter no longer persisted:** The Library channel filter resets to "All Channels" on every launch, as requested — no INI entry for it. Kanal filtresi artık her açılışta "Tüm Kanallar" ile başlıyor — INI kaydı yok.

## [9.7.1] - 2026-08-24

### 🎛️ Library Quick Filters Panel (Kütüphane Hızlı Filtreler Paneli)

- The 7 horizontal-scrollable filter chips in the Library toolbar are now hidden behind a compact **"Filtreler" dropdown button** — the toolbar no longer overflows horizontally. Kütüphane araç çubuğundaki yatay kaydırılabilir 7 filtre hapı artık kompakt bir **"Filtreler" açılır düğmesinin** arkasında — araç çubuğu artık yatay taşmıyor.
- The panel opens as a fixed-position popup (viewport-anchored, same technique as the channel dropdown) so it is never clipped by toolbar overflow. Panel, kanal açılır menüsüyle aynı teknikle viewport'a sabitlenen açılır pencere olarak açılır, araç çubuğu taşmasından asla kesilmez.
- A count badge on the button shows how many filters differ from their default state. Düğmedeki sayı rozeti, varsayılan durumundan farklı olan filtre sayısını gösterir.
- Panel closes on outside click or Escape. Panel, dışarı tıklanınca veya Escape ile kapanır.

## [9.7.0] - 2026-08-24

### 🐛 Channel Dropdown Fix & Channel Filters Bar Alignment (Kanal Açılır Menü Düzeltmesi & Kanal Filtre Çubuğu Hizalama)

- **Fixed channel dropdown being clipped:** The library/downloaded/channels channel picker dropdown was clipped by the toolbar's horizontal overflow — it now opens as a fixed-position popup relative to the viewport, so it is always visible. Kanal seçici açılır menüsü araç çubuğunun yatay kaydırması tarafından kesiliyordu — artık viewport'a göre sabit konumda açılır, her zaman görünür.
- **Channels tab filter bar alignment:** All elements in `.channel-filters-bar` (search input, selects, badge) now share a uniform 34px height with proper alignment. Kanallar sekmesindeki filtre çubuğu öğeleri (arama kutusu, seçim kutuları, rozet) artık ortak 34px yüksekliğe sahip ve düzgün hizalı.

## [9.6.9] - 2026-08-24

### 🛠️ Library Toolbar Layout Fix (Kütüphane Araç Çubuğu Yerleşim Düzeltmesi)

- The Library toolbar is now split into two zones: **filters** (scrollable horizontally when space runs out) and **fixed right actions** (sort buttons + Cards/List view toggle) — the view toggle is always visible, no more 2-line wrap. Kütüphane araç çubuğu iki bölgeye ayrıldı: **filtreler** (yer kalmayınca yatay kaydırılır) ve **sabit sağ aksiyonlar** (sıralama butonları + Kartlar/Sade Liste görünümü) — görünüm seçeneği her zaman görünür, 2 satıra taşma yok.
- Compact sort buttons in the library header. Kütüphane başlığındaki sıralama butonları kompaktlaştırıldı.

## [9.6.8] - 2026-08-24

### 🗂️ Library Sort Mode in configwin.ini (Kütüphane Sıralama Modu configwin.ini'de)

- **New `historySortMode` INI setting:** Library tab videos can now be sorted by `date-desc` (default), `date-asc`, `title`, or `duration` — controlled from the new sort buttons in the Library header and persisted to `configwin.ini`. Yeni `historySortMode` INI ayarı: Kütüphane sekmesi videoları artık `date-desc` (varsayılan), `date-asc`, `title` veya `duration` ile sıralanabilir — Kütüphane başlığındaki yeni sıralama butonlarıyla kontrol edilir ve `configwin.ini`'ye kaydedilir.
- **Persistent & INI-editable:** The chosen sort is saved to db.settings + configwin.ini; manual edits (e.g. `historySortMode = title`) take effect on next launch. Seçilen sıralama db.settings + configwin.ini'ye kaydedilir; elle düzenleme (örn. `historySortMode = title`) bir sonraki açılışta geçerli olur.

## [9.6.7] - 2026-08-24

### 🎨 UI View Preferences in configwin.ini (Görünüm Tercihleri configwin.ini'de)

- **New INI settings:** `historyViewMode` (Library tab: grid/list), `downloadedViewMode` (Downloaded tab: grid/list), and `downloadedSortMode` (Downloaded sort: date-desc/asc, size-desc/asc, user) are now written to and read from `configwin.ini` — the app opens exactly as you last left it. Yeni INI ayarları: `historyViewMode` (Kütüphane: grid/list), `downloadedViewMode` (İndirilenler: grid/list) ve `downloadedSortMode` (İndirilenler sıralama) artık `configwin.ini`'ye yazılıp okunur — uygulama en son bıraktığınız görünümle açılır.
- **db.settings priority on restore:** When restoring view state, `db.settings` (fed from configwin.ini) takes priority over localStorage. Görünüm durumu geri yüklenirken `db.settings` (configwin.ini'den gelen) localStorage'dan önceliklidir.
- **Manual INI editing supported:** Change `historyViewMode = list` in configwin.ini and the Library opens as a list on next launch. configwin.ini'de `historyViewMode = list` yapın — bir sonraki açılışta Kütüphane liste görünümünde açılır.

## [9.6.6] - 2026-08-24

### ⚡ Targeted Channel Info Update (Hedefli Kanal Bilgisi Güncelleme)

- Instead of refreshing ALL channels after import (slow with many channels), the server now updates **only the newly added channels** in the background (600ms apart, ~0.6s per channel). İçe aktarma sonrası TÜM kanalları güncellemek yerine sunucu artık **yalnızca yeni eklenen kanalları** arka planda günceller (kanal başına ~0,6 sn).
- `updateChannelFullInfo` is now exported from `channels.js` and reused by the import endpoint — no duplicate logic. `updateChannelFullInfo` artık `channels.js`'ten export edilir ve içe aktarma uç noktası tarafından yeniden kullanılır.

## [9.6.5] - 2026-08-24

### ⚡ Auto-Refresh Channel Info After Subscription Import (Abonelik İçe Aktarma Sonrası Otomatik Kanal Bilgisi Güncelleme)

- After bulk-importing channels from YouTube subscriptions, the app now automatically triggers the existing "Update All Subscribers & Avatars" feature so newly added channels immediately get their avatar and subscriber count — no manual step needed. YouTube aboneliklerinden kanallar toplu eklendikten sonra uygulama otomatik olarak mevcut "Tüm Abone ve Avatarları Güncelle" özelliğini tetikler; yeni eklenen kanallar avatar ve abone sayısını hemen alır.
- If an RSS scan is already running, the app shows an informational message and you can trigger the update afterwards. RSS taraması devam ediyorsa bilgilendirme mesajı gösterilir; sonrasında elle tetiklenebilir.

## [9.6.4] - 2026-08-24

### 🐛 Fix: UI Freezing During Scans (Tarama Sırasında Arayüz Donması Düzeltmesi)

- **Root cause:** The `history_updated` SSE listener added in v9.6.2 called `updateUI()` (which re-renders the whole queue) on every single update. During RSS scans hundreds of such events arrive per second, freezing the browser — even at startup after a scan. Kök neden: v9.6.2'de eklenen `history_updated` SSE dinleyicisi her güncellemede tüm kuyruğu yeniden çizen `updateUI()`'yi çağırıyordu; RSS taraması sırasında saniyede yüzlerce event gelince tarayıcı donuyordu — açılışta tarama sonrası dahil.
- **Fix:** `history_updated` UI refresh is now debounced to 400ms — render frequency drops from hundreds/sec to ~2.5/sec; the queue list is no longer re-rendered in a tight loop. `history_updated` arayüz tazelemesi 400ms'de bir toplu hale getirildi — render sıklığı saniyede yüzlerden ~2.5'e düştü; kuyruk listesi artık sıkı döngüde yeniden çizilmiyor.
- **Backend cache for subscriptions fetch:** The 11MB `feed/channels` page is now cached for 5 minutes per session — repeated "Fetch" clicks no longer re-download it. `feed/channels` sayfası (11MB) artık oturumda 5 dakika önbelleklenir — tekrarlanan "Getir" tıklamaları sayfayı yeniden indirmez.

## [9.6.3] - 2026-08-24

### ⚡ Subscriptions List Performance (Abonelik Listesi Performansı)

- **Chunked rendering (Parça Parça Render):** The subscription list now renders 100 channels at a time with a "Show More" button — 1000+ channel lists no longer freeze the browser. Abonelik listesi artık 100'er kanal halinde render edilir; 1000+ kanallık listeler tarayıcıyı dondurmaz.
- **Search filter (Arama Filtresi):** A live search box filters channels by name instantly. Kanal adına göre anlık filtreleyen arama kutusu eklendi.
- **Select All (Tümünü Seç):** One-click selection of all not-yet-followed channels — no need to tick 1000 checkboxes. Takip edilmeyen tüm kanalları tek tıkla işaretleyen "Tümünü Seç" butonu eklendi.
- **State-based selection (Durum Tabanlı Seçim):** Selections are tracked in memory, so loading more pages never loses your ticks. Seçimler bellekte tutulur; daha fazla sayfa yüklemek işaretlemelerinizi kaybettirmez.

## [9.6.2] - 2026-08-24

### 🐛 Fix: Subscriptions Buttons Not Responding (Abonelik Butonları Çalışmıyor Düzeltmesi)

- **Root cause:** `app.js` is a monolithic client — `tools.js` / `db-renderer.js` are never loaded, so functions added to `tools.js` were dead code. Subscription functions were moved into the active `app.js` copy (with `window.*` bindings for inline `onclick`). Kök neden: `app.js` monolitik istemcidir — `tools.js`/`db-renderer.js` hiç yüklenmez; `tools.js`'e eklenen fonksiyonlar ölü koddur. Abonelik fonksiyonları aktif `app.js` kopyasına taşındı (inline `onclick` için `window.*` bağlamalarıyla).
- **Completed Adım 6 client-side:** The `history_updated` SSE listener (previously added to the unloaded `db-renderer.js`) was also added to the active `app.js` — targeted update events are now actually received by the client. Adım 6'nın istemci tarafı tamamlandı: yüklenmeyen `db-renderer.js`'e eklenmiş olan `history_updated` SSE dinleyicisi aktif `app.js`'e de eklendi — hedefli güncelleme eventleri artık istemci tarafından gerçekten alınıyor.

## [9.6.1] - 2026-08-24

### 🐛 Fix: Subscriptions Section Not Opening (Abonelikler Bölümü Açılmıyor Düzeltmesi)

- **Fixed duplicate `showToolsSubSection`:** The active copy in `app.js` did not know the new `subscriptions` section, so it fell through to the default File Comparison view. Added the subscriptions branch to the active copy (both copies kept in sync). `app.js`'teki aktif `showToolsSubSection` kopyası yeni `subscriptions` bölümünü bilmiyordu ve varsayılan Dosya Karşılaştırma görünümüne düşüyordu — aktif kopyaya subscriptions dalı eklendi (iki kopya senkron tutuldu).
- **Cache-busting bump to v9.6.1:** Ensures browsers load the fixed `app.js` despite the 7-day static cache. 7 günlük statik önbelleğe rağmen tarayıcıların düzeltilmiş `app.js`'i yüklemesi için sürüm v9.6.1'e çıkarıldı.

## [9.6.0] - 2026-08-24

### 📥 YouTube Subscriptions Import Tool / YouTube Aboneliklerini İçe Aktarma Aracı

- **Fetch & bulk-import your YouTube subscriptions (Abone Kanallarını Getir + Toplu Ekle):** New Tools section reads your subscribed channels from `youtube.com/feed/channels` (using your session cookies) and lists them with checkboxes — already-followed channels are marked. Select any number and add them to your follow list in one click. Araçlar sekmesine yeni bölüm: oturum çerezlerinizle `feed/channels` sayfasından abone kanallarınızı çeker, takip edilenler işaretli checkbox listesi gösterir; seçtiklerinizi tek tıkla takip listenize toplu ekler.
- **Open feed/channels page in WebView2 (feed/channels Sayfasını Aç):** One-click button opens the YouTube subscriptions page inside the WebView2 player (your logged-in session). feed/channels sayfasını WebView2 oynatıcıda tek tıkla açan buton eklendi (oturumunuz açık olduğu için abonelikleriniz görünür).
- **New endpoints:** `GET /api/tools/subscriptions`, `POST /api/tools/subscriptions/import`, `POST /api/tools/open-subscriptions`.
- **i18n:** All labels added in 7 languages. Tüm etiketler 7 dile eklendi.

## [9.5.0] - 2026-08-24

### 🔐 Automatic YouTube Cookie Health Monitoring / Otomatik YouTube Çerez Sağlık Takibi

- **New `cookieHealth.js` service (Yeni `cookieHealth.js` servisi):** Validates YouTube session cookies at server startup and every 30 minutes by fetching the watch-history page and checking its content size (logged-in ~3MB vs signed-out ~780KB). Sunucu açılışında ve 30 dakikada bir, izleme geçmişi sayfasının içerik boyutuna bakarak YouTube oturum çerezlerinin geçerliliğini doğrular (oturum açık ~3MB, kapalı ~780KB).
- **Automatic silent refresh (Otomatik sessiz yenileme):** When cookies are detected invalid, `triggerSilentCookieRefresh` (hidden WebView2) is triggered automatically and verified — no user action needed while the WebView2 session is alive. Çerezler geçersiz algılandığında gizli WebView2 üzerinden otomatik sessiz yenileme tetiklenir ve doğrulanır — WebView2 oturumu canlı olduğu sürece kullanıcı müdahalesi gerekmez.
- **Clear user notification (Net kullanıcı bildirimi):** If automatic renewal also fails, the user receives a visible toast/log: "YouTube oturum çerezleriniz geçersiz! Ayarlar sekmesinden 'YouTube'da Oturum Aç" — no more silent watch-history losses. Otomatik yenileme de başarısız olursa kullanıcıya görünür bir bildirim gösterilir — sessizce kaybolan izleme geçmişi kayıtları sona erer.
- **Fixed `subtitleOpacity` falsy bug (Altyazı Opaklığı Falsy Hatası Düzeltmesi):** `0.0` (fully transparent) is now preserved when writing to `configwin.ini` instead of being rewritten as `0.7`. `configwin.ini`'ye yazarken `0.0` (tam şeffaf) değeri artık `0.7` olarak bozulmuyor.

## [9.4.0] - 2026-08-24

### 🔌 SSE Heartbeat, Dead-Code Cleanup & Log Optimization / SSE Canlılık, Ölü Kod Temizliği ve Log Optimizasyonu

- **SSE Heartbeat (SSE Canlılık Pingi):** A keep-alive comment line is now sent every 25 seconds on the `/api/events` stream, preventing proxy/load-balancer idle timeouts from dropping long-lived connections. `/api/events` akışına 25 saniyede bir keep-alive pingi gönderilir; uzun ömürlü bağlantıların proxy zaman aşımlarıyla kopması önlenir.
- **Dead Terminal Log Broadcast Removed (Ölü Log Yayını Kaldırıldı):** The `terminal_log` SSE broadcast was not consumed by any client — removed; log history is still served via its API endpoint and the tray console reads stdout. `terminal_log` SSE yayını hiçbir istemcide dinlenmiyordu — kaldırıldı; log geçmişi API endpoint'i üzerinden ve tepsi konsolu stdout'tan beslenmeye devam eder.
- **Undefined Render Calls Removed (Tanımsız Render Çağrıları Kaldırıldı):** 12 dead `renderChannels`/`renderHistory` calls (functions never defined) were cleaned up across the client. İstemcide hiç tanımlanmamış 12 ölü `renderChannels`/`renderHistory` çağrısı temizlendi.
- **Note:** History grid already renders in 50-item chunks with a scroll sentinel (lazy render), and RSS channel scanning already batches with `Promise.allSettled` — no change needed there. Not: Geçmiş ızgarası zaten 50'lik parçalar + kaydırma bekçisiyle tembel render yapıyor ve RSS kanal taraması zaten `Promise.allSettled` ile toplu çalışıyor — orada değişiklik gerekmedi.

## [9.3.0] - 2026-08-24

### 🎯 Targeted Update Events / Hedefli Güncelleme Eventleri

- **Targeted `history_updated` SSE Events (Hedefli `history_updated` SSE Eventleri):** Single history record updates now broadcast only `{id, updates}` via a new `history_updated` event instead of sending the entire ~3MB database on every change. Tek bir geçmiş kaydı güncellendiğinde artık her değişiklikte ~3MB veritabanı yerine yalnızca `{id, updates}` iletilir.
- **Client-side targeted patching (İstemci Tarafında Hedefli Güncelleme):** The dashboard now patches the changed record in memory and runs a light UI refresh — the network payload drops from ~3MB to ~1KB per update. Arayüz artık değişen kaydı bellekte güncelleyip hafif bir UI tazelemesi yapar — ağ yükü güncelleme başına ~3MB'den ~1KB'ye düşer.
- **Removed duplicate broadcasts in downloader/queue flows (İndirici/Kuyruk Akışlarında Çift Gönderim Kaldırıldı):** `updateHistoryItem` now emits the targeted event internally; 5 duplicate `db_update` broadcasts were removed. `updateHistoryItem` hedefli eventi kendi içinde yayınlar; 5 çift `db_update` gönderimi kaldırıldı.
- **Full `db_update` retained only for bulk changes** (channel add/remove, history push/splice, settings) — rare operations. Tam `db_update` yalnızca toplu değişikliklerde (kanal ekle/sil, geçmiş ekle/çıkar, ayarlar) korunur — nadir işlemler.

## [9.2.0] - 2026-08-24

### ⚡ Performance & Optimization Update / Performans ve Optimizasyon Güncellemesi

- **Gzip Compression (Gzip Sıkıştırma):** Vanilla `zlib` middleware added — `app.js` (~500KB) is now served at ~120KB; SSE events unaffected. Vanilla `zlib` ile sıkıştırma eklendi — `app.js` (~500KB) artık ~120KB olarak iletilir; SSE etkilenmez.
- **Static File Caching (Statik Dosya Önbelleği):** `express.static` now sends 7-day `Cache-Control` for versioned assets (`?v=`); repeat openings load from disk cache. Sürümlü varlıklara 7 günlük önbellek başlığı eklendi; tekrar açılışlar disk önbelleğinden yüklenir.
- **Compact db.json Format (Kompakt db.json):** Removed JSON indentation — database file ~30% smaller, faster reads/writes. JSON girintisi kaldırıldı — veritabanı dosyası ~%30 küçüldü, okuma/yazma hızlandı.
- **Progress Write Debounce (İlerleme Yazma Debounce):** High-frequency download progress updates no longer write the whole database to disk every time; writes are batched every 1 second (memory cache stays instant). Yüksek frekanslı indirme ilerleme güncellemeleri artık her seferinde tüm veritabanını diske yazmıyor; yazımlar 1 saniyede bir toplu yapılır (bellek önbelleği anlık kalır).
- **Note:** `readDb()` was already using an mtime-based memory cache — no change needed there. Not: `readDb()` zaten mtime tabanlı bellek önbelleği kullanıyordu — orada değişiklik gerekmedi.

## [9.1.1] - 2026-08-24

### 🚀 Major Update v9 — YouTube Integration Overhaul / Sürüm 9 Ana Güncellemesi

- **Live Stream Error Handling & Real Error Reporting (Canlı Yayın Hata Yönetimi & Gerçek Hata Raporlama):**
  - stderr artık `\r` ayracında da bölünüyor; gerçek hata satırları ayrı toplanıyor; kuyruk hata mesajları çöp metin yerine gerçek hatayı gösteriyor.
  - Türkçe canlı yayın hataları ("Bu canlı etkinlik X dakika sonra başlayacak") artık `waiting_live_processing` durumuna düşüp otomatik yeniden denemeyle bekliyor.

- **"Mark as Watched" Real Duration Fix (İzlendi İşaretleme Gerçek Süre Düzeltmesi):**
  - Silme ve APE akışlarında 999999 saniye yerine **gerçek video süresi** + `state=playing` gönderiliyor; YouTube artık videoları "tamamen izlendi" olarak işaretliyor (yalnızca geçmişe eklemek yerine).

- **APE Tool Complete Integration (APE Aracının Tam Entegrasyonu):**
  - APE aracı Araçlar menüsüne eklendi ve tam arayüzü oluşturuldu (link girişi, YouTube senkron onayı, sonuç kutusu).
  - Kanal işaretleme artık 3 katmanlı: takip edilen kanal / kütüphanede kayıtlı kanal / tamamen yabancı kanal (son N videosu YouTube'dan çekilip işaretleniyor).
  - Kanal işaretleme için **ayarlanabilir video sayısı** (1-200) eklendi.

- **Browser Cookie System Removed (Tarayıcı Çerez Sistemi Kaldırıldı):**
  - Eski `browser` (tarayıcıdan çerez okuma) sistemi tamamen temizlendi; çerezler yalnızca WebView2 (oynatıcı) üzerinden alınıyor.
  - "Çerezleri Doğrula" butonu artık WebView2'nin `cookies.txt` dosyasını test ediyor.

- **Tray "YouTube'da Oturum Aç" Fix (Tepsi Oturum Aç Düzeltmesi):**
  - Tepsi menüsündeki buton artık WebView2 oynatıcıyı doğrudan login URL'siyle başlatıyor (Ayarlar sayfasıyla aynı yol).

- **Cache-Busting Fix (Önbellek Düzeltmesi):** `index.html` sürüm parametreleri güncellendi (`?v=9.1.1`) — eski önbelleğin yeni arayüzü gizlemesi engellendi.

## [8.59.0] - 2026-08-24

### 🪟 Tray Menu "YouTube Login" Fix — Direct WebView2 Player Launch / Tepsi Menüsü "YouTube'da Oturum Aç" Düzeltmesi

- **Tray login button now launches `bin/HaYTooLPlayer.exe` directly** with the Google login URL, matching the proven working path used by the Settings page (`/api/open-youtube-login`). The launcher (`HaYTooL-Player Beta.exe`) is kept only as a fallback.
- Tepsi menüsündeki "YouTube'da Oturum Aç" butonu artık launcher üzerinden (görünmez pencere mesajı) değil, **doğrudan `bin/HaYTooLPlayer.exe`'yi login URL'si ile başlatarak** çalışır — Ayarlar sayfasındaki çalışan yöntemle birebir aynıdır. Launcher yalnızca yedek olarak kullanılır.
- **Why:** The launcher's WM_COPYDATA message path silently failed when the player was half-open/invisible, so the login window never appeared.
- **Neden:** Launcher'ın pencere mesajı (WM_COPYDATA) yolu, oynatıcı yarı açık/görünmez durumdayken sessizce başarısız oluyordu; oturum penceresi hiç açılmıyordu.
- Rebuilt `HaYTooL YT Downloader.exe` tray binary.
- `HaYTooL YT Downloader.exe` tepsi uygulaması yeniden derlendi.

## [8.58.0] - 2026-08-24

### 🛠️ Live Stream Error Handling, Real Error Reporting & Clean stderr Filtering / Canlı Yayın Hata Yönetimi, Gerçek Hata Raporlama ve Temiz stderr Filtreleme

- **Real Error Line Collection (Gerçek Hata Satırı Toplama):**
  - Error lines from yt-dlp stderr are now collected separately from WARNING and harmless ffmpeg output; queue failure messages show the actual error instead of mixed-in warning/cookie spam.
  - Kuyruk hata mesajı artık stderr'deki WARNING ve zararsız ffmpeg çıktılarından arındırılmış gerçek hata satırlarını gösterir; çöp hata metinleri ortadan kalktı.

- **False-Positive Cookie Error Fix (Yanlış Pozitif Çerez Hatası Düzeltmesi):**
  - "The provided YouTube account cookies are no longer valid" WARNING lines no longer trigger the "Tarayıcı çerezleri okunamadı" error message. Live stream errors like "Bu canlı etkinlik X dakika sonra başlayacak" are now reported correctly.
  - Çerez uyarı satırları artık yanlışlıkla "Tarayıcı çerezleri okunamadı" hatasına dönüşmez; canlı yayın "Bu canlı etkinlik X dakika sonra başlayacak" gibi gerçek hatalar kullanıcıya doğru gösterilir.

- **Turkish Live Stream Error Patterns (Türkçe Canlı Yayın Hata Kalıpları):**
  - Added Turkish patterns to `isLiveProcessingError`: "canlı etkinlik ... başlayacak", "canlı yayın ... işleniyor" etc. Live streams now defer to `waiting_live_processing` (automatic retry) instead of failing.
  - Türkçe canlı yayın hata mesajları artık `waiting_live_processing` durumuna geçip mevcut `liveStreamTimer` mekanizmasıyla otomatik yeniden denemeyle bekler; `failed` durumuna düşmez.

- **Cleaner Terminal Logs (Daha Temiz Terminal Logları):**
  - Harmless ffmpeg HLS lines (`id3v2_priv...transportStreamTimestamp`, `Thread message queue blocking`, `size=...time=...bitrate=` progress) are now filtered from error logs.
  - Zararsız ffmpeg HLS satırları (`id3v2_priv...transportStreamTimestamp`, `Thread message queue blocking`, `size=...time=...bitrate=` ilerleme satırları) artık hata loguna karışmaz.

- **Carriage-Return Line Splitting (Satır Ayracı Düzeltmesi):**
  - stdout/stderr now split on `\r` as well; merged progress lines no longer produce garbage error messages.
  - stdout/stderr artık `\r` ayracında da bölünür; birleşen ilerleme satırları çöp hata mesajı oluşturmaz.

## [8.57.0] - 2026-08-24

### ⚡ Instant 0ms Video Playback, Double-Play Prevention & SSE Database Broadcast Elimination / Anında 0ms Gecikmesiz Oynatma, Üst Üste Oynatma Koruması ve Veritabanı Yayın Optimizasyonu

- **Instant 0ms Video Player Startup (Gecikmesiz Anında Oynatma):**
  - Eliminated blocking `await fetchSponsorSegments()` and `await fetchSubtitles()` before launching video player instances. Video modals and playback elements now mount and start instantly (0ms latency) upon user interaction.
  - Subtitles and SponsorBlock timeline segment markers are now fetched asynchronously in the background and attached non-blockingly without delaying playback.
  - Video oynatma butonuna basıldığında SponsorBlock ve altyazıların beklenmesi engellendi; oynatıcı anında açılarak arka planda akıllıca yükleme yapılması sağlandı.

- **Strict Concurrency Request Locking (Üst Üste Ses & Video Çalma Engelleyici):**
  - Added atomic `activePlayRequestId` transaction guard to prevent stale asynchronous video playback initialization when switching quickly between videos.
  - Enhanced `cleanupAllPlayers()` to actively pause, disconnect sources, remove DOM `<video>`/`<audio>` tags, and destroy existing player instances before initializing new streams.
  - Bir videodan diğerine hızlıca tıklandığında eski videonun arka planda asılı kalıp sesinin ikinci videonun üstüne binmesi ve çift ses çıkması sorunu tamamen çözüldü.

- **SSE Database Broadcast Elimination on Watchtime Sync (İzleme Süresinde UI Donması ve Titremeyi Önleme):**
  - Removed full-database `broadcast('db_update', db)` triggers from heartbeat endpoints (`/api/video/:id/sync-watchtime` and `/api/video/:id/save-position`).
  - Completely eliminated unnecessary DOM re-rendering thrash, tab freezing, and high CPU usage caused by continuous database broadcast loops during video playback.
  - İzleme süresi ve kaldığı yer güncellemelerinde istemciye tüm veritabanının tekrar tekrar gönderilmesi ve sekmelerin gereksiz yeniden çizilerek arayüzü kasması engellendi.

## [8.56.0] - 2026-08-24

### 💽 Configurable Two-Tier Disk Sync, Silent Background Scanning & Compact INI Architecture / İki Kademeli Disk Senkronizasyon Ayarları, Sessiz Arka Plan Taraması ve Kompakt INI Mimarisi

- **Two-Tier Granular Disk Synchronization Controls (İki Kademeli Disk Senkronizasyon Yönetimi):**
  - Separated disk synchronization into two independent controls: **Startup Scan** (`autoDiskSync`, default: `true`) and **Periodic Background Sync Interval** (`periodicDiskSyncInterval`, default: `360` minutes / 6 hours).
  - Added background interval options: *Never / Disabled (`off`)*, *Every 15 Minutes (`15`)*, *Every 30 Minutes (`30`)*, *Every 1 Hour (`60`)*, *Every 6 Hours (`360` - Default)*, and *Once a Day (`1440`)*.
  - Disk senkronizasyonu iki bağımsız kontrole ayrıldı: Sistem Açılışında Doğrulama (Açık/Kapalı) ve Arka Plan Tarama Sıklığı (Asla, 15 dk, 30 dk, 1 saat, 6 saat, 24 saat).

- **Silent Periodic Background Execution (Sessiz Arka Plan Taraması):**
  - Background periodic sync no longer floods the UI with success toasts or terminal logs when `0` records are updated (`updatedCount === 0`).
  - Toasts and terminal alerts are now strictly reserved for manual on-demand triggers via *"Sync Disk Now"* or when actual file discrepancies are resolved.
  - Arka plan taramalarında dosyalarda değişiklik olmadığı sürece ekrana gereksiz popup basılması engellendi.

- **Clean & Compact `configwin.ini` Generation (Sade ve Kompakt INI Dosyası Yapısı):**
  - Removed the redundant 45-line top summary reference table from `writeIni()` and `configwin.ini`, significantly decreasing file size and clutter.
  - Added comprehensive bilingual (TR/EN) descriptions for all settings directly above each key in `configwin.ini` and `server/config.js`.
  - `configwin.ini` başındaki mükerrer özet tablo kaldırılarak dosya yarı yarıya küçültüldü; her ayarın üzerine detaylı açıklamalar entegre edildi.

- **Full 7-Language Internationalization (7 Dilde Tam Yerelleştirme):**
  - Added translation tokens across TR, EN, ES, DE, PT, RU, and AR for all new disk sync controls and dropdown options.
  - Yeni eklenen tüm arayüz bileşenleri ve seçenekler 7 dilde eksiksiz tanımlandı.

## [8.55.0] - 2026-08-24

### ⚡ High-Performance UI Engine, Chunked Lazy Grid & Instant Filter Response / Yüksek Performanslı Arayüz Motoru, Kademeli Grid Yükleme ve Anlık Filtreleme

- **Chunked Lazy Grid & Virtual Infinite Scroll (Kademeli ve Anlık Grid Yükleme Motoru):**
  - Re-architected `renderVideoGrid` to use `DocumentFragment` and chunked initial rendering (first 50 items rendered in <10ms).
  - Integrated `IntersectionObserver` sentinel to seamlessly stream additional video chunks on demand without any UI stutter or frame drops with 6,000+ items.
  - 6.000'den fazla videonun bulunduğu devasa veritabanlarında ilk 50 kartın 10ms'den kısa sürede anında çizilmesi sağlandı; kaydırdıkça `IntersectionObserver` ile sonraki kartlar arka planda takılmasız yüklenir.

- **Loop Memory Caching & Elimination of Synchronous Disk Reads (Döngü İçi localStorage Okumalarının Kaldırılması):**
  - Extracted repetitive `localStorage.getItem('haytool_playback_resume')` and `JSON.parse` operations completely out of the 6,000-card render loop to execute only once upfront.
  - Kart döngüsü içinde 6.000 kez disk/storage sorgusu yapılması engellendi, tek bir bellek haritası üzerinden O(1) hızında okunması sağlandı.

- **Scoped Lucide SVG Icon Transformation (Hedefe Yönelik İkon Dönüştürme):**
  - Scoped `lucide.createIcons` strictly to `{ root: gridElement }`, preventing full-document traversal of 18,000+ icons and eliminating 1.5-2.5s JavaScript Main Thread lockups.
  - İkon dönüştürme işlemi sadece ilgili gride hedeflenerek tüm sayfa kilitlenmesi tamamen ortadan kaldırıldı.

- **Active Tab Isolation & Auth Status Throttling (Aktif Sekme İzolasyonu ve Ağ İsteği Optimizasyonu):**
  - Prevented invisible background tabs (`downloadedGrid` / `historyGrid`) from recalculating and re-rendering when filters in the active tab change.
  - Eliminated continuous `/api/youtube-auth-status` HTTP requests during UI filter updates.
  - Filtre tıklamalarında sadece açık olan sekme güncellenir; arka plandaki sekmelerin ve gereksiz ağ isteklerinin arayüzü yavaşlatması önlendi.

## [8.54.0] - 2026-08-23

### 🎬 Smart Playback Resume, Visual Progress Indicators & Dedicated YouTube Login UI / Akıllı Kaldığım Yerden Devam Etme, Görsel İlerleme Çubuğu ve Doğrudan YouTube Oturum Arayüzü

- **Smart Server-Synced Playback Resume (Akıllı ve Sunucu Senkronlu Kaldığım Yerden Devam Etme):**
  - Added persistent playback position tracking in `db.json` (`lastPositionSeconds`, `durationSeconds`, and `lastWatchedAt`).
  - Added new backend API endpoint `POST /api/video/:id/save-position` with secure thread-safe database locking (`acquireDbLock`) and real-time SSE broadcasting (`db_update`).
  - Automatically restores playback position seamlessly across all 3 embedded players (ArtPlayer, Plyr, and HTML5 standard).
  - Displays a sleek, non-intrusive transient notification card (*"Resuming from: 04:12"*) when seeking to the saved timestamp upon player launch.
  - Automatically resets saved position when reaching the end of the video (>= 95% or last 5 seconds).
  - `db.json` veritabanına izlenen videoların kaldığı saniye (`lastPositionSeconds`), toplam süresi ve son izlenme zamanı güvenli veritabanı kilidi (`acquireDbLock`) ile eklendi. Tüm gömülü oynatıcılarda (ArtPlayer, Plyr, HTML5) video açıldığında otomatik olarak kaldığı saniyeye sarar ve ekranda şık bir bildirim kartı gösterir. Video sonuna gelindiğinde pozisyon otomatik sıfırlanır.

- **Visual Thumbnail Progress Indicators (Küçük Resimlerde YouTube/Netflix Tarzı İlerleme Çubuğu):**
  - Added a slim, glowing red progress bar (`.video-playback-progress-container` / `.video-playback-progress-bar`) at the bottom of video thumbnails across the Library (History) and Downloaded grids.
  - Displays precise percentage and timestamp tooltip (`Kaldığı Yer: 04:12 (35%)`) on hover.
  - Kütüphane ve İndirilenler kartlarının alt kısmına YouTube/Netflix tarzı kırmızı ışıltılı izleme ilerleme çubuğu eklendi; farenin üzerine gelindiğinde kaldığı dakikayı ve yüzdesini ipucu olarak gösterir.

- **Dedicated "Sign in to YouTube" Button in Settings Tab (Ayarlar Sekmesine "YouTube'da Oturum Aç" Butonu):**
  - Added a dedicated, vibrant red "Sign in to YouTube" button (`btn-open-yt-login`) in `public/partials/tab-settings.html` next to "Verify Cookies" and "Sign Out".
  - Works seamlessly whether running inside the HaYTooL-Player (WebView2) or external web browsers (Chrome, Edge, Firefox).
  - Full 7-language localization (`tr`, `en`, `es`, `de`, `pt`, `ru`, `ar`) and synchronized i18n support.
  - Ayarlar sekmesindeki "Çerez & Bildirim" kartına doğrudan YouTube oturumu açmayı tetikleyen kırmızı renkli "YouTube'da Oturum Aç" butonu eklendi; hem yerleşik player içinde hem harici tarayıcılarda sorunsuz çalışır ve 7 dilde desteklenir.

## [8.53.0] - 2026-08-22

### 🔄 100% Automated YouTube Background Cookie Refresh & Watchtime Sync / %100 Tam Otomatik Arka Plan YouTube Çerez Yenileme ve İzleme Senkronu

- **100% Automated Silent Cookie Refresh Engine (Arka Planda %100 Tam Otomatik Çerez Yenileme):**
  - Eliminated the need to manually open/close the "Sign in to YouTube" window when session tokens expire.
  - Added background keepalive timer in `HaYTooLPlayer` (WPF C# / WebView2) running every 15 minutes and on window focus/startup to silently ping `https://www.youtube.com/generate_204` with credentials and write updated `cookies.txt` and `bin/cookies.txt`.
  - Added silent background command `--silent-cookie-refresh` in `player_launcher.cs` and `MainWindow.xaml.cs` allowing the backend to trigger a 2-second invisible cookie refresh in the background even if the player GUI is not open.
  - Scheduled automatic background cookie maintenance every 30 minutes in `server.js`.
  - Kullanıcının "YouTube'da Oturum Aç" penceresini manuel açıp kapatma zorunluluğu ortadan kaldırıldı; arka planda çalışan görünmez canlılık döngüsü ve 30 dakikalık otomatik bakım servisi ile `cookies.txt` dosyası %100 otomatik olarak güncel tutulur.

- **YouTube 1080p Premium (Enhanced Bitrate) Detection & `1080pPre` Badge (1080p Premium Tespiti ve Özel 1080pPre Rozeti):**
  - Enhanced `getVideoResolution` in `server/services/paths.js` using `ffprobe` JSON stream analysis to detect YouTube Premium's Enhanced Bitrate 1080p streams (> 6.2 Mbps).
  - Automatically tags downloaded and disk-synced 1080p Premium videos with `actualQuality: '1080pPre'`.
  - Added dedicated styling in `public/style.css` (`.video-quality-badge.quality-1080ppre` and `.playlist-item-quality.quality-1080ppre`) with a distinguished glowing Ruby / Fuchsia-Gold gradient, clearly distinguishing it from standard blue `1080p` badges in both dark and light themes.
  - `server/services/paths.js` içindeki `getVideoResolution` fonksiyonu `ffprobe` JSON akış analizini kullanacak şekilde geliştirildi; YouTube Premium'a özel yüksek bit hızlı (Enhanced Bitrate > 6.2 Mbps) 1080p akışları otomatik olarak tespit edilip `1080pPre` olarak etiketlenir. Video kartlarında standart mavi 1080p'den farklı olarak şık ve parlak Yakut-Mor/Altın gradyan rozetle gösterilir.

## [8.52.0] - 2026-08-22

### ⚡ Direct XML RSS, Sequential Startup & UI/Config Enhancements / Doğrudan XML RSS, Sıralı Açılış ve Arayüz/Yapılandırma Geliştirmeleri

- **Eliminated Proxy Pool Discovery Lockup during Channel Scans (Kanal Taramalarında Proxy Havuzu Kilitlenmesi Giderildi):**
  - Removed dynamic proxy pool search fallback (`getWorkingProxy` / `fetchRestrictedChannelVideos`) from automatic scheduler (`timer`), startup scans (`startup`), and single/parallel channel checks.
  - Eliminated CPU freezes and system lockups previously caused by concurrent background yt-dlp test processes querying public proxy lists.
  - Otomatik zamanlayıcı (`timer`), açılış taraması (`startup`) ve tekil/paralel kanal kontrollerinde başarısız kanalların dinamik proxy havuzu aramasına (`getWorkingProxy`) düşmesi ve çok sayıda arka plan `yt-dlp` test süreci başlatarak sistemi kilitlemesi sorunu tamamen giderildi.

- **Direct YouTube XML RSS Engine (Doğrudan YouTube XML RSS Motoru):**
  - Refactored `fetchChannelVideosXml` in `server/services/rss.js` to directly request YouTube RSS XML feeds (`https://www.youtube.com/feeds/videos.xml?channel_id=...`) via direct HTTPS connections with a strict 5-second timeout, bypassing 3rd-party CORS proxy waterfalls (`allorigins`, `codetabs`).
  - Fast scan mode seamlessly falls back directly to local `yt-dlp` (`--flat-playlist`, `--dump-json`) if XML RSS is unavailable for custom channels/handles, guaranteeing lightning-fast and stable checks.
  - `server/services/rss.js` içindeki `fetchChannelVideosXml` fonksiyonu 3. parti proxy şelaleleri yerine doğrudan yerel HTTPS bağlantısı ve 5 saniye zaman aşımı ile çalışacak şekilde optimize edildi. XML bulunamayan kanallarda anında doğrudan `yt-dlp` yedeğine geçilerek maksimum hız ve kararlılık sağlandı.

- **Sequential Startup Lifecycle (Sistem Açılışında Sıralı Disk Senkronizasyonu & Kanal Taraması):**
  - Streamlined startup routine in `server.js` to execute `syncDbWithDisk()` first, ensuring all downloaded files on local disk are verified and database is reconciled before any startup channel scan begins.
  - Automatically triggers `triggerChannelCheck('startup')` immediately after disk synchronization completes if `checkChannelsOnStartup` is active.
  - Removed duplicate and uncoordinated startup timers and redundant console logging.
  - Sunucu açılışında önce yerel diskteki videoları tarayıp veritabanını eşitleyen `syncDbWithDisk` çalıştırılır; disk senkronizasyonu eksiksiz bittikten hemen sonra başlangıç kanal taraması başlatılır. Mükerrer zamanlayıcılar ve log satırları temizlendi.

- **Topbar Duo Status Badge with Dual Dots (Topbar Bağlantı ve Çerez Rozetlerinin 2 Durum Noktasına Birleştirilmesi):**
  - Combined `badge-connection` and `badge-cookie` into a single compact `.status-badge-duo` cell with 2 minimalist indicator dots, saving significant horizontal space in the topbar.
  - Added rich multilingual hover tooltips (`title`) across 7 supported languages to display detailed status for both server connection and YouTube session/cookie authentication.
  - Üst barda çok yer kaplayan bağlantı ve çerez durum rozetleri tek bir hücrede 2 durum noktası (`status-badge-duo`) olarak birleştirildi. Fare üzerine gelindiğinde 7 dilde detaylı durum açıklamaları gösterilmektedir.

- **Comprehensive Bilingual Config Documentation & Updated Defaults (Yapılandırma Dosyası Türkçe/İngilizce Açıklamaları ve Yeni Varsayılanlar):**
  - Documented all 38+ settings in `configwin.ini` and `server/config.js` (`settingComments`) with bilingual (TR / EN) descriptions, valid options, and default values.
  - Added a Default Settings Reference table at the top of `configwin.ini`.
  - Updated application defaults: `channelCheckInterval = 1800` (30 mins), `alternativeSpeedLimit = 3000` KB/s, `lang = en`.
  - `configwin.ini` ve `server/config.js` içindeki tüm ayar başlıklarına Türkçe ve İngilizce açıklamalar, seçenekler ve varsayılan değerler eklendi; dosya başına referans tablosu entegre edildi. Varsayılan ayarlar `channelCheckInterval = 1800`, `alternativeSpeedLimit = 3000`, `lang = en` olarak güncellendi.

- **Dead Code Cleanup (Ölü Kod ve Kullanılmayan Import Temizliği):**
  - Removed unused `fetchRestrictedChannelVideos` and `getWorkingProxy` import from `server/services/rss.js`.
  - Removed unused `getWorkingProxy` import from `server/routes/channels.js`.
  - `server/services/rss.js` ve `server/routes/channels.js` içindeki kullanılmayan proxy çağrıları ve ölü kodlar temizlendi.

## [8.51.0] - 2026-08-20

### 🔧 Topbar Cookie Status Simplified to Dot Indicator / Üst Bar Çerez Durumu Nokta Göstergesine Sadeleştirildi

- **Removed Cookie Text & Icon from Topbar (Üst Bardan Çerez Metni ve İkonu Kaldırıldı):**
  - Removed the `#topbar-cookie-icon` shield icon and the `#topbar-cookie-label` text ("YouTube: Oturum Açık/Anonim") from the topbar (`public/partials/header.html`).
  - The status is now shown solely by the `#cookie-test-indicator` dot: green (`#22c55e`) when the YouTube session is active, red (`#ef4444`) when anonymous. Clicking the dot still triggers the cookie test.
  - `public/partials/header.html` içindeki kalkan ikonu (`#topbar-cookie-icon`) ve "YouTube: Oturum Açık/Anonim" metni (`#topbar-cookie-label`) kaldırıldı. Durum artık yalnızca `#cookie-test-indicator` noktasıyla gösterilir: oturum açıksa yeşil (`#22c55e`), anonimse kırmızı (`#ef4444`). Noktaya tıklanınca çerez testi hâlâ çalışır.

- **Dead Code Cleanup (Ölü Kod Temizliği):**
  - Removed unused references in `public/app.js`: `topbar-cookie-title` binding, `cookieStatus` / `topbarCookieStatus` / `topbarCookieIcon` variables and their status/icon update blocks (now unused `status_logged_in` / `status_logged_out` / `topbar_cookie_title` localization keys removed from all 7 language files).
  - `public/app.js` içindeki kullanılmayan `topbar-cookie-title` bağlama, `cookieStatus` / `topbarCookieStatus` / `topbarCookieIcon` değişkenleri ile durum/ikon güncelleme blokları kaldırıldı; artık kullanılmayan `status_logged_in` / `status_logged_out` / `topbar_cookie_title` yerelleştirme anahtarları 7 dil dosyasından da silindi.

## [8.50.0] - 2026-08-20

### 🚀 APE (Direct Video/Channel Watched Marker Tool) / APE (Hızlı İzlendi İşaretleme Aracı)

- **APE Tool Card in Tools Tab (Araçlar Sekmesine APE Kartı):**
  - Added `#tools-ape-container` with input field (`#ape-target-input`), execute button (`#btn-ape-mark-watched`), YouTube watchtime sync toggle (`#ape-sync-youtube-checkbox`), and dynamic status response box (`#ape-result-box`).
  - Added backend endpoint `POST /api/tools/ape-mark-watched` supporting direct video URL, short URL, raw 11-char Video ID, and Channel Handle (`@Handle`) / Channel URL / Name matching.
  - Automatically marks local database entries as watched/hidden (`hidden: true, watched: true`) and broadcasts `db_update` to live clients.
  - Optionally syncs playback to YouTube watch history (`syncVideoWatchtimeToYouTube`).

- **7-Language i18n Localization (7 Dilde i18n Çevirileri):**
  - Added APE translations to `tr.js`, `en.js`, `es.js`, `de.js`, `pt.js`, `ru.js`, `ar.js`.

## [8.49.0] - 2026-08-20

### 👁️ Unlisted Video Badge & Channels Tab Auto/Shorts Filters / Liste Dışı Video Belirteci & Kanallar Tabı Filtreleri

- **Unlisted Video Detection & Dual-Theme Badge (Liste Dışı Video Tespiti ve Rozeti):**
  - Added `isUnlisted` resolution to YouTube metadata parser (`server/services/rss.js` -> `parseDurationFromHtml` / `fetchVideoDuration`).
  - Added `.video-unlisted-badge` (amber glassmorphism top-left badge) and `.video-card-unlisted-tag` (meta tag) to video cards (`public/components/videoCard.js` & `public/style.css`), fully compatible with all color themes.
  - Sadece bağlantıya sahip olanların erişebildiği liste dışı videolar için video kartlarına belirteç rozeti ve etiketi eklendi.

- **Channels Tab Filtering Bar (Kanallar Tabı Filtreleme Çubuğu):**
  - Added `.channel-filters-bar` in `tab-channels.html` with instant search input (`#channel-list-search-input`), Auto Download filter (`#filter-channel-auto-download`: All / On / Off), Shorts Download filter (`#filter-channel-shorts-download`: All / On / Off), and live count badge (`#channel-filtered-count-badge`).
  - Updated `public/components/channelRow.js` to dynamically filter channels and re-index the A-Z alphabet sidebar and card groups in real-time.
  - Kanallar sekmesinde kanalları isim/handle ile arama, otomatik indirme ve Shorts indirme açık/kapalı durumlarına göre anlık filtreleme desteği eklendi.

- **7-Language i18n Localization (7 Dilde i18n Çevirileri):**
  - Added localization keys to `tr.js`, `en.js`, `es.js`, `de.js`, `pt.js`, `ru.js`, `ar.js`.

## [8.48.0] - 2026-08-20

### 🔄 Disk Synchronization Control & Real-time Logging / Disk Senkronizasyonu Kontrolü & Canlı Loglama

- **Real-time Terminal & Console Logs (Canlı Terminal & Konsol Bildirimleri):**
  - Added dedicated start and completion logs in `syncDbWithDisk` / `performDiskSync` broadcasting to both system terminal and web terminal buffer (`[Disk Sync] Başlatıldı...` / `[Disk Sync] Tamamlandı: X video doğrulandı, Y güncellendi`).
  - Disk senkronizasyonu başladığında ve tamamlandığında konsola ve terminale renklendirilmiş detaylı istatistik bildirimleri eklendi.

- **Auto Disk Sync Setting & Manual Trigger Button (Otomatik Senkronizasyon Ayarı ve Manuel Buton):**
  - Added `settings.autoDiskSync` toggle in Settings (`tab-settings.html` / `app.js` / `database.js` / `config.ini`) allowing users to enable or disable automatic verification on startup and setting changes.
  - Added **"Sync Disk Now" (`#btn-manual-disk-sync`)** button in Settings with animated loading state and `POST /api/settings/sync-disk` endpoint for on-demand manual synchronization.
  - Ayarlar sekmesine otomatik disk senkronizasyonunu açıp kapatma seçeneği ve tek tıkla diski anında senkronize eden manuel buton eklendi.

- **7-Language i18n Localization (7 Dilde i18n Çevirileri):**
  - Updated `tr.js`, `en.js`, `es.js`, `de.js`, `pt.js`, `ru.js`, `ar.js` with new localization keys.

## [8.47.0] - 2026-08-20

### 🎨 Downloaded Video Actual Quality Badge (`ffprobe` Analysis) / İndirilen Videolara Gerçek Çözünürlük Rozeti

- **Downloaded Video Cards Quality Badge (`.video-quality-badge`) (Sol Alt Çözünürlük Rozeti):**
  - Added dedicated resolution badge in the bottom-left corner of video thumbnails across Downloaded grid (`videoCard.js`) and playlist sidebar (`app.js`).
  - Styled with vibrant, theme-aware glassmorphism badge colors tailored to video resolution tiers:
    - `8K` / `4K`: Golden Amber & Purple gradient with glow (`#fbbf24`).
    - `2K` / `1440p`: Elegant Purple / Magenta accent (`#c084fc`).
    - `1080p`: Crisp Cyan / Sky Blue (`#38bdf8`).
    - `720p`: Bright Green (`#4ade80`).
    - `480p` / `360p` / `240p` / `144p`: Clean Slate Gray (`#cbd5e1`).
  - İndirilenler sekmesindeki video kartlarının kapak resminin sol alt köşesine videonun gerçek çözünürlüğünü gösteren şık, cam efektli ve çözünürlüğe göre renkli rozetler eklendi.

- **Automated `ffprobe` Video Stream Analysis (`getVideoResolution`) (Otomatik ffprobe Çözünürlük Tespiti):**
  - Integrated `getVideoResolution` in `paths.js` using local `ffmpeg/ffprobe.exe` to inspect downloaded video stream height.
  - Automatically records `actualQuality` to `db.json` history items upon download completion and during disk sync.
  - İndirme tamamlandığında ve disk senkronizasyonunda `ffprobe` ile video yüksekliği taranarak veritabanına işlenir.

## [8.46.0] - 2026-08-20

### ⏱️ YouTube Watchtime & Position Sync / YouTube İzleme Süresi ve Kaldığın Yeri Eşitleme

- **Interactive Watchtime Sync Button (`#inline-btn-sync-watchtime`) (Tek Tıkla Eşitleme Butonu):**
  - Added a dedicated 32x32 button in the inline player actions toolbar (`tab-downloaded.html`) right next to details refresh.
  - Instantly captures current playback position (`player.currentTime`, e.g., `01:30`) and synchronizes it with your YouTube Watch History using the official YouTube Watchtime Tracking API (`/api/stats/watchtime`) with active session tokens.
  - İndirilenler oynatıcı aksiyon çubuğuna tek tıkla izleme süresini YouTube hesabına eşitleyen yeni buton eklendi. O anki dakika/saniye YouTube izleme geçmişine işlenir.

- **Smart Auto-Sync on Pause / Close (`autoSyncWatchtime`) (Akıllı Otomatik Senkronizasyon):**
  - Added configurable toggle `[X] YouTube İzleme Süresi Eşitleme` in Settings (`tab-settings.html`).
  - When enabled, automatically saves the playback position to YouTube watch history in the background when pausing or closing the player.
  - Ayarlar sayfasına otomatik eşitleme seçeneği eklendi; videoyu duraklatınca veya kapatınca kaldığınız yer YouTube'a otomatik kaydedilir.

- **Full 7-Language i18n & Settings Persistence (7 Dil & Kalıcı Ayarlar):**
  - Fully translated in Turkish, English, Spanish, German, Portuguese, Russian, and Arabic across all UI cards, settings, and toast notifications.
  - Persisted in `configwin.ini` and `database.json`.

## [8.45.0] - 2026-08-20

### 🎬 Mark Video as Watched on YouTube on Delete / Silme Sırasında YouTube'da İzlendi Olarak İşaretleme

- **Mark as Watched on Delete Confirmation (`#mark-watched-checkbox`) (Silme Modalı İzlendi Seçeneği):**
  - Added dedicated toggle checkbox `[X] YouTube'da da izlendi olarak işaretle` in the video delete confirmation modal (`modals.html`).
  - Automatically persists the user's latest preference in `configwin.ini`, `database.json`, and `localStorage` (`markWatchedOnDelete`), restoring the last selected state in subsequent delete dialogs.
  - Silme onay modalına "YouTube'da da izlendi olarak işaretle" seçeneği eklendi. Kullanıcının tercihi `configwin.ini` ve veritabanına kaydedilir ve bir sonraki silme işleminde otomatik hatırlanır.

- **Background YouTube Watch History Tracking (`markVideoWatchedOnYouTube`) (Arka Plan İzleme Sinyali):**
  - Upon deletion approval, when marked, triggers background `yt-dlp --cookies cookies.txt --mark-watched --skip-download` using the active session token to mark the video as watched/fully watched in the user's YouTube Watch History without downloading any files.
  - Diskteki dosya silinip kütüphanede gizlenirken arka planda YouTube izleme geçmişine izlendi sinyali gönderilir ve gerçek zamanlı durum bildirimi iletilir.

- **Full 7-Language i18n & Persistence (7 Dil Desteği):**
  - Translated all new modal options and status logs into Turkish, English, Spanish, German, Portuguese, Russian, and Arabic.

## [8.44.0] - 2026-08-20

### 🎯 Strict Cookies.txt Authentication Detection & Status Fix / Kesin Çerez Doğrulaması ve Durum Rozeti Düzeltmesi

- **Strict Valid-Cookie Detection (Gerçek Oturum Doğrulaması):**
  - Removed misleading false-positive check that marked session as active simply because `EBWebView\...\Cookies` SQLite database existed.
  - Connected `GET /api/youtube-auth-status` and `downloader.js` directly to verified `cookies.txt` contents (`LOGIN_INFO` / `__Secure-1PSID`).
  - Simplified and standardized status badges across Topbar and Settings page.
  - SQLite dosyasının varlığından kaynaklanan sahte "Oturum Aktif [HaYTooL Dahili]" uyarısı giderildi; durum rozeti artık yalnızca geçerli `cookies.txt` oturum token'ları bulunduğunda aktifleşir.

## [8.43.0] - 2026-08-20

### 🧹 Complete In-Memory & Disk YouTube Sign Out Synchronization / Tam Bellek ve Disk YouTube Oturum Kapatma Senkronizasyonu

- **In-Memory & Native WebView2 Cookie Purge (`ClearYouTubeSessionAsync`) (Bellek ve WebView2 Oturumunu Tamamen Temizleme):**
  - Fixed an issue where signing out from the UI was immediately overridden 1 second later by the background `HaYTooL-Player` auto-syncing in-memory WebView2 cookies back to `cookies.txt`.
  - Added native `ClearYouTubeSessionAsync` in `MainWindow.xaml.cs` to delete in-memory Google/YouTube session cookies via `CoreWebView2CookieManager`.
  - Added inter-process `LOGOUT` command routing via `player_launcher.cs` and `POST /api/logout-youtube`.
  - Tightened `SyncYouTubeCookiesToFileAsync`: Only generates `cookies.txt` if valid user authentication tokens (`LOGIN_INFO` / `__Secure-1PSID`) are actively present; otherwise purges any orphaned cookie files.
  - Arayüzden oturum kapatıldığında açık olan HaYTooL-Player'ın hafızasındaki çerezleri tekrar diske yazıp oturumu açık göstermesi sorunu çözüldü; WebView2 bellek çerezleri anında temizlenir ve `cookies.txt` otomatik silinir.

## [8.42.0] - 2026-08-20

### 🚪 YouTube Sign Out Feature & Downloader Verification / YouTube Oturumu Kapatma Butonu & Downloader Doğrulaması

- **YouTube Sign Out Action (Ayarlar ve Sistem Tepsisine "Oturumu Kapat" Butonu):**
  - Added dedicated **"Oturumu Kapat" (Sign Out)** button (`#btn-logout-youtube`) in the Settings tab alongside "Çerezleri Doğrula" with interactive confirmation dialog.
  - Added "YouTube Oturumunu Kapat" action to the Windows System Tray right-click context menu in all 7 languages.
  - Implemented backend endpoint `POST /api/logout-youtube` to safely delete `cookies.txt`, `bin/cookies.txt` and reset isolated WebView2 session state, instantly updating UI indicators back to "YouTube: Anonim" mode.
  - Ayarlar sekmesine ve Windows sistem tepsisi sağ tık menüsüne 7 dilde "Oturumu Kapat" seçeneği eklendi. Tıklandığında yerel çerezleri güvenle temizler ve rozetleri anında "YouTube: Anonim" durumuna döndürür.

- **Downloader Tab & Format Verification (Araçlar / Downloader Sekmesi Doğrulaması):**
  - Verified and confirmed that the manual Downloader tab (`tab-downloader.html` & `handleDownloaderStart`) operates at 100% full capacity with the updated cookie bridge, authenticated clients (`player_client=tv,web_creator,mweb,web`), and FFmpeg merge workflows for all custom video qualities (Best, 1080p, 720p) and MP3 formats.
  - Araçlar menüsündeki Downloader sekmesinin güncel çerez motoru, özel format seçicisi ve FFmpeg birleştirme süreçleriyle %100 uyumlu ve eksiksiz çalıştığı doğrulandı.

## [8.41.0] - 2026-08-20

### 🛡️ Topbar YouTube Auth Live Indicator & Settings Cleanup / Üst Bar Canlı YouTube Oturum Rozeti & Ayarlar Temizliği

- **Topbar Live YouTube Auth Badge (`#badge-cookie`) (Üst Bar Canlı YouTube Oturum Rozeti):**
  - Updated the topbar status badge `#badge-cookie` from legacy browser names to a live YouTube authentication state indicator.
  - Displays **"YouTube: Oturum Açık"** with a glowing green pulse dot (`#22c55e`) when logged in, or **"YouTube: Anonim"** (`#ef4444`) when no session is active.
  - Clicking the badge triggers instant cookie verification (`testCookies()`).
  - Üst bardaki `#badge-cookie` alanı harici tarayıcı isimleri yerine doğrudan canlı YouTube oturum durumunu gösterecek şekilde güncellendi ("YouTube: Oturum Açık" / "YouTube: Anonim"). Rozete tıklandığında anında canlı çerez doğrulaması yapılır.

- **Removed Legacy "Premium Cookie Browser" Setting (Eski "Premium Çerez Tarayıcısı" Ayarı Kaldırıldı):**
  - Completely removed the redundant external browser selection dropdown (`#settings-browser`) from the Settings tab and application state.
  - The application now relies purely on the secure, zero-lock native YouTube session bridge (`cookies.txt` & isolated WebView2 profile).
  - Ayarlar sekmesindeki gereksiz harici tarayıcı seçim menüsü (`#settings-browser`) ve ilgili kodlar tamamen temizlendi; sistem artık sıfır kilitlenme garantili yerel YouTube oturum köprüsünü kullanır.

- **Optimized Cookie-Compatible Client Extraction (`player_client=tv,web_creator,mweb,web`) (Çerez Uyumlu İstemci Rotasyonu):**
  - Updated yt-dlp extractor arguments to ensure full 4K (3840x2160) and 1080p stream availability when cookies are present, bypassing PO Token bottlenecks.
  - yt-dlp istemci argümanları güncellenerek çerez aktifken 4K ve 1080p DASH akışların PO Token engeline takılmadan eksiksiz çekilmesi sağlandı.

## [8.40.0] - 2026-08-20

### 🔐 Native YouTube Session & Cookie Integration + Anti-360p Fallback Protection / Dahili YouTube Oturumu & Çerez Entegrasyonu + 360p Düşme Koruması

- **Native YouTube Authentication via Isolated WebView2 Profile (`HaYTooL-Player`) (İzole WebView2 Profili ile Dahili YouTube Oturum Açma):**
  - Added native YouTube sign-in integration directly within HaYTooL (`HaYTooL-Player Beta.exe`). Users can sign into their Google/YouTube accounts within an isolated WebView2 profile (`%LOCALAPPDATA%\HaYTooLPlayer_Main`).
  - Once signed in, yt-dlp automatically recognizes the authenticated session, completely bypassing YouTube's bot challenges, GVS PO Token requirements, SABR streaming experiments, and HTTP 429 rate limits.
  - HaYTooL içinde izole WebView2 profili üzerinden yerel YouTube oturum açma entegrasyonu eklendi. Kullanıcı Google/YouTube hesabıyla giriş yaptığında yt-dlp oturumu otomatik tanır; bot doğrulamaları, PO Token dayatmaları, SABR kısıtlamaları ve 429 hataları tamamen aşılır.

- **Multi-Tier Cookie Priority & Zero Database Locking (Çok Katmanlı Çerez Önceliği & Sıfır Kilitlenme):**
  - Dynamic cookie loader (`getCookieArgs`): Prioritizes 1) Root `cookies.txt` -> 2) Native HaYTooL WebView2 Session -> 3) User-selected External Browser (`chrome`, `edge`, `firefox`, `brave`, `opera`).
  - Using HaYTooL's isolated WebView2 profile prevents SQLite file lock errors (`EPERM` / `cookie database locked`) even when your daily Chrome/Edge browsers remain open.
  - Dinamik çerez yükleyici eklendi: 1) `cookies.txt` -> 2) Dahili WebView2 YouTube Oturumu -> 3) Harici Tarayıcı. Dahili profil kullanımı sayesinde günlük tarayıcınız açık kalsa dahi çerez kilitlenme çakışması yaşanmaz.

- **Anti-Quality-Degradation (360p Format 18 Fallback Protection) (Kalite Düşmesi & 360p Koruma Kalkanı):**
  - Enhanced extractor arguments (`player_client=android_vr,web,visionos`) and format sort rules to ensure 4K/1440p/1080p adaptive DASH streams (AV1, VP9, Opus) are always acquired without silently degrading to legacy Format 18 (360p).
  - Geliştirilmiş akıllı istemci rotasyonu ile 4K/1080p akışların gizlenmesi önlendi, videoların sessizce 360p Format 18'e düşmesi engellendi.

- **System Tray Menu Integration & Settings Simplification (Sistem Tepsisi Menü Entegrasyonu & Sadeleştirilmiş Ayarlar):**
  - Added dedicated "Sign in to YouTube" (`YouTube'da Oturum Aç`) action directly to the Windows System Tray right-click context menu (`tray.cs` -> `HaYTooL YT Downloader.exe`) with full 7-language support (`tr`, `en`, `es`, `de`, `pt`, `ar`, `ru`).
  - Simplified Settings tab: Removed redundant web-based popup buttons in favor of an elegant, live-updating Cookie Status Badge and a single "Verify Cookies" action with interactive tray guidance hints.
  - Windows sistem tepsisi (Tray) sağ tık menüsüne 7 dilde "YouTube'da Oturum Aç" seçeneği eklendi. Ayarlar sekmesi sadeleştirildi; karmaşık web butonları kaldırılarak sadece canlı durum rozeti, çerez doğrulama butonu ve sağ tık ipucu bırakıldı.

## [8.39.0] - 2026-08-19

### 🎬 HaYTooL-Player Beta.exe — Direct HDD Playback Fix (Stream Bypass) / Doğrudan HDD'den Oynatma Düzeltmesi (Stream Bypass)

- **Root Cause Fixed: `CoreWebView2_NavigationStarting` Was Blocking Virtual Drive URLs (`MainWindow.xaml.cs`) (Kök Neden Düzeltildi: `CoreWebView2_NavigationStarting` Sanal Sürücü URL'lerini Engelliyordu):**
  - `SetVirtualHostNameToFolderMapping` correctly mapped all local drives to `haytool-X.local` virtual hosts, and `app.js` correctly generated `http://haytool-f.local/...` URLs inside WebView2.
  - However, the `CoreWebView2_NavigationStarting` event handler treated `haytool-*.local` as an external domain and cancelled navigation (`e.Cancel = true`), causing fallback to the HTTP stream endpoint.
  - Added `isVirtualDrive` guard: URLs matching `haytool-*.local` pattern are now recognized as internal WebView2 resources and are no longer redirected to the external browser.
  - `SetVirtualHostNameToFolderMapping` tüm yerel sürücüleri `haytool-X.local` sanal sunucularına doğru eşliyordu ve `app.js` WebView2 içinde `http://haytool-f.local/...` URL'lerini doğru üretiyordu. Ancak `CoreWebView2_NavigationStarting` handler'ı bu adresleri dış link sayıp navigasyonu iptal ederek stream fallback'ine düşürüyordu. Eklenen `isVirtualDrive` koruması sayesinde artık bu URL'ler WebView2 içinde kalır ve video dosyaları doğrudan HDD'den okunur — hiçbir HTTP stream katmanı devreye girmez.

- **Zero Network Traffic for Local Videos (Yerel Videolar İçin Sıfır Ağ Trafiği):**
  - Local downloaded videos now load instantly via virtual drive mapping with no localhost HTTP streaming overhead.
  - Undownloaded or live videos continue to use YouTube iframe embed as before.
  - İndirilen yerel videolar artık sanal sürücü eşlemesi üzerinden anında yüklenir, localhost HTTP stream katmanı yoktur. İndirilmemiş veya canlı yayın videoları önceki gibi YouTube iframe embed kullanmaya devam eder.

- **No Changes to Backend or Frontend (Backend veya Frontend'de Değişiklik Yok):**
  - Only `HaYTooLPlayer/MainWindow.xaml.cs` was modified. `server/routes/streams.js` and `public/app.js` required no changes.
  - Yalnızca `HaYTooLPlayer/MainWindow.xaml.cs` değiştirildi. `server/routes/streams.js` ve `public/app.js` değiştirilmedi.

## [8.38.0] - 2026-08-19


### 🌐 Smart Geo-Restriction & Court-Blocked Video Bypass / Akıllı Coğrafi Kısıtlama & Mahkeme Kararlı Video Tüneli

- **Automatic Geo-Block Rescue Tunnel with Zero Impact on Normal Downloads (Normal İndirmeleri Etkilemeyen Otomatik Kurtarma Tüneli):**
  - Preserved 100% direct fiber connection speed for standard unrestricted videos without touching proxies.
  - Automatically activates a verified HTTPS proxy tunnel only when YouTube returns country-level legal blocks (`Video unavailable due to a legal complaint`).
  - Standart engelsiz videolarda doğrudan yerel internet hızından (%100 doğrudan bağlantı) ödün verilmez; yalnızca mahkeme kararıyla engellenmiş videolarda otomatik çalışan proxy tüneli devreye girer.

- **Full HD 1080p60 AV1/AVC1 & Opus Stream Extraction (1080p60 Full HD ve Yüksek Kalite Ses Akış Desteği):**
  - Removed restrictive `player_client=android` parameters that caused yt-dlp to downgrade geo-blocked videos to legacy 360p (Format 18).
  - Cleanly fetches separate adaptive streams: Format 399/299 (1080p60 AV1/AVC1) + Format 251 (Opus audio) and merges them into lossless `.mp4` via FFmpeg.
  - Engelli videoların 360p'ye düşme sorunu kökten çözüldü; tüm videolar 1080p Full HD kalitesinde indirilir.

- **YouTube CDN 403 Forbidden Proxy Auto-Rotation (Proxy Otomatik Rotasyonu):**
  - Integrated smart retry with `rotateProxy()` in `downloader.js` so that if YouTube CDN returns a temporary 403 Forbidden on a proxy IP, the engine instantly switches to the next available working proxy and resumes the download seamlessly.
  - Proxy IP'si YouTube CDN'inde 403 aldığında indirme iptal olmaz; sıradaki çalışan tünele geçilerek indirme kesintisiz tamamlanır.

### 🛡️ Atomic Database Concurrency & Windows File Lock Resilience / Atomik Veritabanı Eşzamanlılık ve Kilit Güçlendirmesi

- **Zero-Conflict Write Engine (`server/database.js`):**
  - Introduced unique randomized temporary file paths (`dbPath.<timestamp>.<rand>.tmp`) combined with a 5-step fallback retry loop to prevent `EPERM` / `ENOENT` collisions on Windows under heavy parallel write loads.
  - Windows ortamında yoğun eşzamanlı SSE bildirimleri ve indirmeler esnasında `db.json.tmp` dosya kilitleme çakışmaları tamamen ortadan kaldırıldı.

## [8.37.0] - 2026-08-18

### 🚀 yt-dlp Engine Channel Manager, Nightly VisionOS Bypass & Download Priority Lock / yt-dlp Sürüm & Kanal Yöneticisi, Nightly VisionOS Kalkanı ve İndirme Öncelik Kilidi

- **Advanced yt-dlp Engine Version & Channel Manager in Settings (`/settings` Sekmesinde Gelişmiş yt-dlp Sürüm ve Kanal Yöneticisi):**
  - Integrated dynamic multi-channel yt-dlp selector (`Nightly`, `Stable`, and historical release rollback list) directly in the Settings tab.
  - Automatically queries the latest 6 Nightly and 6 Stable releases from GitHub API (`/api/downloader/ytdlp-version`).
  - Added one-click version switching & updating (`/api/downloader/ytdlp-update` via `--update-to <target>`) with active channel badge (`🌙 Nightly` vs `⭐ Stable`).
  - Ayarlar sekmesine dinamik yt-dlp sürüm ve kanal seçim paneli eklendi. Kullanıcılar artık tek tıkla en güncel Nightly veya Kararlı (Stable) sürüme geçebilir veya geçmiş sürümleri seçip geri alabilir.

- **Auto-Download & Auto-Healing on First Install / Missing Binary (İlk Kurulum ve Eksik Dosyada Otomatik İndirme):**
  - Upgraded `ensureYtdlp()` in `server/services/downloader.js` to automatically fetch and install the latest working Nightly `yt-dlp.exe` / `yt-dlp` from GitHub if the local binary is missing.
  - New users will never encounter broken/outdated yt-dlp versions or missing file errors upon first startup.
  - Klasörde `yt-dlp.exe` bulunmasa dahi uygulama ilk açılışta veya indirme başlangıcında en güncel çalışan Nightly sürümünü GitHub'dan otomatik olarak indirip hazır hale getirir.

- **YouTube CDN 403 Forbidden & 360p SABR Bypass via VisionOS Client (VisionOS İstemcisiyle 403 ve SABR Kısıtlamalarını Aşma):**
  - Updated bundled `yt-dlp\yt-dlp.exe` to `2026.08.17` nightly build featuring the new `visionos` player client, cleanly bypassing YouTube's `android_vr` 403 restrictions and SABR degradation.
  - Removed outdated fallback that downgraded failed downloads to 360p (`format 18`); enhanced download queue with exponential retry backoff (`--fragment-retries 10 --retries 5 --retry-sleep fragment:exp=1:20`), preserving full 1080p60 AV1 / 4K stream quality.
  - `yt-dlp.exe` en güncel sürüme güncellendi ve YouTube'un 403 engeli koyduğu videolar en yüksek kalitede (1080p60 AV1) başarıyla indirilebilir kılındı.

- **Download Priority Lock over Background Channel Scanning (İndirme Öncelik Kilidi & Kanal Taramasını Duraklatma):**
  - Enhanced `triggerChannelCheck` and `checkAllChannelsRssParallel` in `server/services/rss.js` with active download detection (`while (activeDownloads > 0 || queue.length > 0)`).
  - Background startup and periodic timer channel checks are automatically deferred while downloads are active or pending in the queue, eliminating network congestion and YouTube IP rate-limiting.
  - Aktif video indirmesi devam ederken veya kuyrukta bekleyen video varken kanal taramaları otomatik olarak duraklatılır; video indirmesi bittiğinde tarama kaldığı yerden devam eder.

### 💡 Interactive CLI & Console Command Guide & Help Button / İnteraktif CLI & Konsol Komut Rehberi ve Yardım Butonu

- **System Tray Console "Yardım" Button & Interactive Command Guide (Tepsi Konsoluna "Yardım" Butonu ve Komut Rehberi):**
  - Added dedicated Purple "Yardım" button (`helpButton`, `#8E44AD`) in `tray.cs` right-click "Konsol Çıktısını Göster" window with modern 4-button layout (`[Komut Kutusu]`, `[Gönder]`, `[Temizle]`, `[Yardım]`, `[Aç]`).
  - Created `ShowCliHelpDialog` with interactive command cards, syntax badges, examples, and localized 7-language UI strings.
  - Features one-click **"Kullan" (Use)** action that automatically inserts and focuses command templates directly into the console command input box, and one-click **"Kopyala" (Copy)** to clipboard.
  - Tepsi "Konsol Çıktısını Göster" penceresine mor "Yardım" butonu ve tek tıkla konsola komut aktaran/kopyalayan modern interaktif komut rehberi penceresi eklendi.

- **Full 7-Language Localization for Console Buttons & Command Guide (Konsol Butonları ve Komut Rehberinde Tam 7 Dil Desteği):**
  - Resolved language switching issues where console window buttons remained static; dynamically bound `cmdLabel`, `sendButton`, `clearButton`, `helpButton`, and `openLogButton` to runtime language updates (`ApplyConsoleFormLanguage`).
  - Added comprehensive native translations for all 9 commands and their descriptions across **TR, EN, DE, ES, PT, RU, and AR** in `ShowCliHelpDialog` (eliminating fallback to Turkish in non-English modes).
  - Enhanced `GetLanguageSetting()` in `tray.cs` to read active language from memory, `db.json`, and `configwin.ini` simultaneously.
  - Tepsi konsol penceresindeki tüm butonlar (`Gönder`, `Temizle`, `Yardım`, `Aç`, `Komut:`) ve Yardım kılavuzundaki 9 komutun tamamı 7 dilde (TR, EN, DE, ES, PT, RU, AR) eksiksiz çevrildi ve anlık dil senkronizasyonuna bağlandı.

- **Expanded Server Console (stdin) Command Engine (Genişletilmiş Konsol Komut Motoru):**
  - Implemented comprehensive runtime stdin commands in `server.js` (`status`, `speed <val|off|on>`, `altspeed <val>`, `ton`, `toff`, `toggle`, `pd <link>`, `clear`, `help`).
  - Added multi-language Turkish and English aliases (`turtleon`, `turtleoff`, `turtleac`, `turtlekapat`).
  - Konsol stdin dinleyicisine tüm hız profili, tek tuş geçiş (toggle) ve indirme komutları entegre edildi.

- **Binary Compilation & System Synchronization:**
  - Recompiled `HaYTooL YT Downloader.exe` via `0nogithub/build_tray.ps1`.
  - Sürüm 4 ana dosyada eş zamanlı olarak `v8.37.0` yapıldı.

## [8.36.0] - 2026-08-18

### 🚀 Major Engine & Console Overhaul: YouTube 403/DRM Shield, Remote EJS Challenge Solver & Tray Console Clear Button / Büyük Motor & Konsol Güncellemesi: YouTube 403/DRM Kalkanı, Uzaktan EJS Çözücü & Tepsi Konsolu Temizle Butonu

- **YouTube 403 Forbidden & DRM Deprecation Fix (Kökten 403 ve DRM Engeli Çözümü):**
  - Deprecated outdated `android_vr` and DRM-restricted `tv` player clients in `server/services/downloader.js` and `server/services/rss.js`.
  - Migrated to the modern, stable `player_client=android,web` sequence.
  - Enabled `--remote-components ejs:github` to dynamically resolve modern YouTube JavaScript `n-challenge` algorithms with the Node.js runtime.
  - YouTube tarafından engellenen `android_vr` ve `tv` istemcileri kaldırılıp güncel `android,web` ve uzaktan EJS JS challenge çözücüsüne geçilerek 403 Forbidden hataları kökten çözüldü.

- **Smart Auto-Retry Fallback System (Akıllı Otomatik Kurtarma & Fallback):**
  - Implemented automatic fallback retry mechanism: on transient CDN 403/503 limits, the downloader automatically transitions to the standalone `android` client and re-attempts download within 3 seconds without marking videos as failed.
  - Olası anlık sunucu kısıtlamalarında otomatik olarak bağımsız Android akış istemcisine geçiş yapan akıllı kurtarma mekanizması entegre edildi.

- **System Tray "Konsol Çıktısını Göster" Clear Button (Tepsi Konsoluna "Temizle" Butonu):**
  - Added dedicated "Temizle" (`clearButton`, `#E67E22`) to the right-click System Tray Console window (`tray.cs`), positioned between "Gönder" and "Aç".
  - Instantly clears on-screen terminal text without touching persistent disk logs in `logs/`.
  - Recompiled `HaYTooL YT Downloader.exe` via `0nogithub/build_tray.ps1`.
  - Sistem tepsisi sağ tık "Konsol Çıktısını Göster" penceresine log görünümünü temizleyen turuncu "Temizle" butonu eklendi ve `HaYTooL YT Downloader.exe` yeniden derlendi.

- **Rich Terminal Output & Color Rendering (Zengin Konsol Çıktıları ve Renklendirme):**
  - Added vibrant color rules (Neon Amber `#FFB700`, Emerald Green `#2ECC71`, Cyan `#00E1FF`) in `tray.cs` for `[403 Koruması]`, `[Kuyruk Auto-Retry]`, and `[İndirme Başarılı]` terminal events.
  - Konsol penceresindeki kuyruk, yeniden deneme ve 403 koruma logları göz alıcı ve bilgilendirici renklerle formatlandı.

## [8.35.2] - 2026-08-17

### 🐛 Bug Fix: Strict Purple-Dot Members-Only Alignment & RSS Error Message Disambiguation / Hata Düzeltmesi: Mor Noktalı Üyelere Özel Eşlemesi ve RSS Hata Mesajı Ayrıştırması

- **Strict Purple Dot (status-dot-members) Sync:**
  - Standardized `isMembersOnlyVideo(item)` helper across both `videoCard.js` and `app.js` filtering.
  - Only videos that receive the purple status dot (`status: failed` with actual YouTube membership error or `isMembersOnly: true`) are categorized as Members-Only.
  - Sadece video kartında mor nokta (`status-dot-members`) alan gerçek Katıl/Üyelik hatalı videolar üyelere özel filtresine tabi tutulur; mavi noktalı ("ignored") sona eren canlı yayınlar veya gizli videolar artık filtreden etkilenmez.

- **RSS Feed Error Disambiguation:**
  - Disambiguated generic unavailable error in `server/services/rss.js` to accurately categorize ended live streams, private videos, and members-only videos individually.
  - `rss.js` içindeki genel hata mesajı ayrıştırılarak canlı yayın sonlanması, gizli video ve üyelere özel içerikler birbirinden ayrıldı.

## [8.35.1] - 2026-08-17

### 🔄 Refinement: Members-Only Show/Hide Toggle Mode / İyileştirme: Üyelere Özel Videoları Göster/Gizle Toggle Modu

- **Show / Hide Members-Only Toggle (Üyelere Özel Videoları Göster/Gizle Anahtarı):**
  - Updated the "Üyelere Özel" filter button (`#btn-filter-show-members`) from an exclusive single-category filter into a show/hide toggle, consistent with the Shorts (`history-show-shorts`) and Live (`history-show-live`) chips.
  - When enabled (active), members-only videos are displayed alongside standard videos. When disabled (inactive), members-only videos are filtered out and hidden from the Library list.
  - "Üyelere Özel" butonu, tıpkı Shorts ve Canlı yayın butonları gibi listede üyelere özel videoları gösterme veya tamamen gizleme anahtarı (toggle) olarak güncellendi.

## [8.35.0] - 2026-08-17

### 🚀 New Feature: Members-Only Filter & State Persistence in Library Tab / Yeni Özellik: Kütüphane Sekmesinde Üyelere Özel Filtresi ve Kalıcı Tercih Hatırlama

- **Dedicated "Members-Only" Filter Chip in History Toolbar (Kütüphane Toolbarında Üyelere Özel Filtre Çipi):**
  - Added a new responsive filter button (`#btn-filter-members-only`) with a crown icon (`crown`) to `#tab-history > .history-toolbar`.
  - When enabled, only videos identified as YouTube Members-Only / Channel Membership content (`isMembersOnly` or error containing membership join requirements) are displayed.
  - Kütüphane sekmesine taç simgeli "Üyelere Özel" filtreleme butonu eklendi; tıklandığında yalnızca Katıl/üyelik gerektiren özel videolar listelenir.

- **Persistent Preference Across App Restarts (Kalıcı Tercih Hatırlama):**
  - Integrated the members-only filter state into `saveHistoryFilterState()` and `restoreHistoryFilterState()` via `localStorage` (`haytool_history_filters_v2`).
  - The filter preference is remembered and restored automatically on subsequent application launches and page reloads.
  - Yapılan filtreleme tercihi yerel depolamaya kaydedilerek uygulamanın sonraki açılışlarında otomatik olarak korunur ve hatırlanır.

- **Multi-Language Localization (7 Dilde Çeviri Desteği):**
  - Added `lbl_history_only_members_only` across all 7 supported interface languages: Turkish, English, German, Spanish, Portuguese, Russian, and Arabic.
  - Tüm arayüz dillerine ilgili çeviriler eklendi.

## [8.34.0] - 2026-08-17

### 🚀 Major Feature: Floating / PiP Video Player Overhaul, Aspect-Locked Resizing & Zero-Lag Live DOM Reparenting / Büyük Özellik: Yüzen / PiP Video Oynatıcı Yenilemesi, En-Boy Kilitli Boyutlandırma & 0-Gecikmeli Canlı DOM Transferi

- **Aspect-Ratio Locked Proportional Resizing (En-Boy Oranı Kilitli Orantılı Boyutlandırma):**
  - Revamped `#player-modal` resizing engine with 8 responsive handles (4 corners + 4 edges).
  - Resizing width or height automatically calculates proportional dimensions based on exact video aspect ratio (16:9 for Widescreen, 9:16 for Shorts, or real native stream resolution).
  - Videos never get distorted ("tipi kaymaz"), letterbox black bars are prevented, and viewport boundaries ensure player controls and timeline never get clipped.
  - Oynatıcı modalına 8 yönlü yeniden boyutlandırma tutamacı eklendi; dikey Shorts veya 16:9 yatay videolarda en ve boy oranı kilitli olarak kusursuz orantılı boyutlandırma sağlandı.

- **Zero-Lag Instant Continuous Playback via Live DOM Reparenting (Canlı DOM Transferi ile 0-Gecikmeli Kesintisiz Oynatma):**
  - Replaced player destroy & reload cycle during tab transitions (`switchTab`) with seamless live DOM reparenting.
  - When navigating away from the Downloaded tab to Library, Queue, or Settings (or vice-versa), the active `<video>` or `Artplayer` DOM instance is instantly reparented into the floating player without stopping media decoding, resetting audio/video streams, or losing loaded subtitle settings and SponsorBlock segment markers.
  - Sekmeler arası geçişlerde oynatıcının baştan başlatılması yerine canlı DOM transferi kullanılarak 1-2 saniyelik kopmalar ve donmalar tamamen ortadan kaldırıldı; akış 0ms gecikmeyle kesintisiz devam eder.

- **Independent Memory Management for Shorts & Widescreen (Shorts ve Geniş Ekran İçin Ayrık Hafıza):**
  - Split localStorage geometry keys into `player-modal-short-*` and `player-modal-wide-*`.
  - Switching between Shorts and Standard widescreen videos cleanly resets inline style artifacts, preventing sticky aspect pollution.
  - Shorts ve yatay videolar için pencere boyut ve konum kayıtları birbirinden tamamen ayrıldı; bir videonun boyutu diğerini etkilemez.

- **Draggable & Safe Viewport Clamping (Serbest Taşınabilirlik ve Ekran Sınırı Güvencesi):**
  - Smooth header-based dragging with strict viewport edge collision detection (`Math.max` / `Math.min`) ensuring seek bar and controls are 100% visible at all times.
  - Başlık çubuğundan serbestçe taşınabilir hale getirildi; ekran kenarlarından taşma engeli ile alt ilerleme çubuğu daima görünür tutuldu.

## [8.33.0] - 2026-08-17

### 🚀 New Feature: Multi-View Queue System, Arrow Ordering & Metadata Polish / Yeni Özellik: Çoklu Görünümlü Kuyruk Sistemi, Oklarla Sıralama & Metadata İyileştirmeleri

- **Dual-Mode Dynamic Queue View: Table & Cards (Çift Modlu Dinamik Kuyruk Görünümü: Tablo ve Kartlar):**
  - Replaced the reset engine button in `#tab-queue > .content-header` with a sleek **View Switcher** (`#queue-view-toggle-container`), allowing users to toggle between **Data Table View (Tablo)** and **Glass Cards View (Kartlar)** on the fly.
  - User's view preference (`queueViewMode: 'table' | 'cards'`) is automatically saved and read from `config.ini` under `[Settings]` and preserved across app restarts.
  - Kuyruk başlığındaki motor sıfırlama butonu yerine kullanıcıların dilediği an Tablo ve Kart görünümleri arasında geçiş yapabileceği dinamik bir menü eklendi; tercih `config.ini` dosyasına kaydedilerek kalıcı hale getirildi.

- **Persistent Metadata Visibility & Calculating State (Kesintisiz Metadata Görünürlüğü & Hesaplama Durumu):**
  - Every single video in the queue and pre-downloaded list now prominently displays **Order Number (`#01`, `#02`...)**, **16:9 Thumbnail Cover**, **Video Title**, **Channel Name**, **Duration**, and **File Size**.
  - If a video's file size or duration is pending calculation, a sleek animated calculating badge (`Hesaplanıyor...` / `Calculating...`) is displayed, eliminating layout shifts or missing information.
  - Kuyruktaki ve ön indirilenler listesindeki tüm videolarda sıra numarası, kapak resmi, başlık, kanal, süre ve dosya boyutu eksiksiz gösterilecek şekilde düzenlendi; boyutu hesaplanmakta olan videolara sarı nabız animasyonlu `Hesaplanıyor...` rozeti eklendi.

- **Up & Down Arrow Move Controls (Yukarı ve Aşağı Taşıma Okları ile Hızlı Sıralama):**
  - Added intuitive Up (▲) and Down (▼) arrow buttons to each queue item in addition to native drag-and-drop reordering.
  - Instant DOM updates with real-time `/api/queue/reorder` synchronization. Top items disable the Up arrow and bottom items disable the Down arrow.
  - Sürükle-bırak yöntemine ek olarak her satıra/karta anında çalışan Yukarı ve Aşağı taşıma butonları eklendi.

- **HQ Hover Thumbnail Cycling in Queue Lists (Kuyrukta Alternatif Kapak Döngüsü):**
  - Integrated `video-thumbnail-wrapper` across both "Sıradaki Videolar" and "Ön İndirilen Videolar" in both views.
  - Hovering over video thumbnails smoothly cycles through high-resolution frames (`hq1.jpg`, `hq2.jpg`, `hq3.jpg`), respecting the user's `enableAltThumbnailsHover` setting.
  - Kuyruk sekmesindeki tüm video kapakları fare üzerine gelindiğinde anlık HQ kareleri dönecek şekilde donatıldı.

- **Vertical Auto-Expansion (Dikeyde Otomatik Büyüme):**
  - Removed restrictive `max-height: 400px` scrollbars from queue lists. Lists now expand naturally with content length.
  - Listeler içerik uzunluğuna göre dikeyde otomatik büyüyecek şekilde ayarlandı.

- **Downloaded Tab Shorts Toggle Fix (İndirilenler Sekmesi Shorts Butonu Onarımı):**
  - Fixed an issue where clicking the "Shorts Videolarını Göster" toggle in the Downloaded tab did not synchronize with settings or filter the grid properly.
  - Enhanced `isShortVideo` helper with robust multi-type validation to prevent parsing failures on numeric or non-standard duration inputs.
  - İndirilenler sekmesindeki Shorts toggle butonunun senkronizasyonu ve `isShortVideo` tip güvenliği onarıldı.

## [8.32.0] - 2026-08-15

### 🌤️ New Feature: Topbar Weather Indicator & Location Settings / Yeni Özellik: Üst Bar Hava Durumu & Konum Ayarları

- **Minimalist Topbar Weather Badge (Minimalist Üst Bar Hava Durumu Rozeti):**
  - Integrated an ultra-sleek, clean weather status badge (`#badge-weather`) in `.topbar-status-badges` displaying live temperature (e.g., `☀️ 24°C`) and dynamic Lucide weather icons.
  - Hovering over the badge displays a detailed multi-line tooltip with location city name, weather description, perceived temperature (*Feels like*), humidity percentage, and wind speed in km/h.
  - Clicking the weather badge triggers an instant cache-bypass refresh.
  - Üst bar durum rozetleri alanına (`#badge-weather`) canlı derece ve dinamik hava durumu ikonu içeren minimalist bir gösterge eklendi; üzerine gelindiğinde konum, durum, hissedilen sıcaklık, nem ve rüzgar bilgilerini içeren detaylı ipucu sunar.

- **Configurable Location & Geocoding in Settings (Ayarlardan Yapılandırılabilir Konum ve Koordinat Arama):**
  - Added dedicated Weather Configuration options under **General & Appearance Settings** (`tab-settings.html`):
    - Enable/Disable toggle for topbar weather badge.
    - City Search with auto-completion using Open-Meteo Geocoding API (`GET /api/weather/geocode`).
    - One-click GPS Location Finder using browser geolocation API.
    - Editable Latitude & Longitude coordinate inputs.
    - Temperature Unit Selector: Celsius (°C) / Fahrenheit (°F).
  - Open-Meteo API entegrasyonu ile harici anahtara gerek kalmadan anlık hava durumu çekilir; sunucu tarafında 15 dakikalık bellek içi önbellekleme yapılarak gereksiz ağ trafiği önlenir.

- **Full 7-Language i18n & Theme Compatibility (Tam 7 Dil ve Tema Uyumu):**
  - Weather terms, units, and WMO weather condition descriptions were integrated across all 7 language dictionaries (`tr`, `en`, `de`, `es`, `pt`, `ru`, `ar`).
  - Styled with full support for Dark, Light, Matrix, Discord, and YouTube themes.

## [8.31.0] - 2026-08-15

### 🛠️ Bug Fixes / Hata Düzeltmeleri

- **Web UI Toast Raw HTML Fix (Web Arayüzü Toast Bildirimi Ham HTML Düzeltmesi):**
  - Fixed a bug in `public/components/toast.js` where broken regex replacements caused raw CSS/HTML strings (e.g., `color: #c084fc; font-weight: 600;`) to be rendered as literal text inside toast notifications instead of styled content.
  - Reverted `formatToastMessage` function and restored clean plain-text toast message output.
  - `public/components/toast.js` dosyasındaki hatalı iç içe regex değiştirme nedeniyle bildirim balonlarında `color: #c084fc;` gibi ham CSS kodlarının görünmesi düzeltildi.

- **Tray "Konsol Çıktısını Göster" Rich Color Rendering (Tepsi Konsol Penceresi Zengin Renklendirmesi):**
  - Enhanced `AppendColoredText` in `tray.cs` with a token-based segment parser for the Windows System Tray "Konsol Çıktısını Göster" RichTextBox window.
  - `[Abone & Avatar]`, `[Kanal Logosu]`, `[Abone Sayısı]` tags are now highlighted in **Orchid/Purple (`#DA70D6`)**.
  - Progress counters like `70/101` are highlighted in **Bold Gold (`#FFD700`)**.
  - Channel names and video titles inside quotes `"..."` are highlighted in **Bold Neon Cyan (`#00F0FF`)**.
  - Recompiled `HaYTooL YT Downloader.exe` via `0nogithub/build_tray.ps1`.
  - `tray.cs` içindeki `AppendColoredText` fonksiyonu token tabanlı segment ayrıştırıcı ile güncellendi. Kanal tarama satırlarında etiketler eflatun, sayaçlar altın sarısı kalın, kanal adları ise neon camgöbeği kalın renkte basılacak. Tepsi uygulaması yeniden derlendi.

## [8.30.0] - 2026-08-15

### Improvements & Terminal Aesthetics / İyileştirmeler & Terminal Estetiği

- **Unnecessary RSS/yt-dlp Fallback Elimination & Empty JSON Bug Fix (Gereksiz Fallback Çağrısının Kaldırılması & Boş JSON Düzeltmesi):**
  - Refactored `resolveChannelId` in `server/routes/channels.js` to return immediately when HTML scraping successfully extracts channel name, avatar URL, and subscriber count, eliminating redundant background fallback calls to `tryRssFallback`.
  - Updated `tryRssFallback` arguments for yt-dlp to `--dump-single-json --flat-playlist --playlist-items 1` with empty output validation, fixing the `Unexpected end of JSON input` error caused by `--playlist-items 0` in modern yt-dlp versions.
  - HTML üzerinden kanal bilgileri eksiksiz alındığında fazladan `tryRssFallback` çalıştırılması engellendi; `yt-dlp`'nin `--playlist-items 0` parametresinden kaynaklanan boş çıktı ve JSON parse hatası giderildi.

- **Distinct Terminal Console Color Highlights (Terminal Konsolunda Belirgin Renk Vurguları):**
  - Enhanced `colorizeText` in `server.js` with dedicated ANSI color tokens.
  - Progress counters in channel scan logs (e.g., `70/101`) are highlighted in **bold bright yellow (`\x1b[93m\x1b[1m`)**, while channel names within quotes (e.g., `"Özlem Gürses"`) are distinctly highlighted in **bold bright cyan (`\x1b[96m\x1b[1m`)**.
  - Kanal güncelleme çıktılarındaki ilerleme sayacı (ör. `70/101`) kalın parlak sarı, tırnak içerisindeki kanal adı (ör. `"Özlem Gürses"`) ise kalın parlak camgöbeği/turkuaz renk ile belirginleştirilerek konsol okunabilirliği artırıldı.

## [8.29.0] - 2026-08-15

### Major Enhancements & Concurrency Architecture / Ana Geliştirmeler & Eşzamanlılık Mimarisi

- **Channel Metadata vs Video RSS Mutual Concurrency Lock (Kanal Taraması & Video RSS Taraması Çakışma Koruması):**
  - Implemented mutual exclusion locking (`isChannelScanInProgress` and `isRssChecking`) across all scanning triggers (server startup, UI button, system tray menu, and background timer).
  - Background RSS video checking is deferred automatically when a bulk channel subscriber/avatar scan is active, and channel metadata scans are prevented from starting while an RSS feed check is underway.
  - Added 5-minute (300s) automatic watchdog timers to both lock mechanisms to prevent stale locking states.
  - Kanal abone/avatar taraması ile video RSS taramasının (açılışta, zamanlayıcıda veya elle) birbirinin üstüne binmesi engellendi. Biri çalışırken diğeri güvenle ertelenir veya kullanıcıya bilgilendirme sağlanır; 5 dakikalık bekçi (watchdog) ile kilitlenmeler önlenir.

- **Primary YouTube Channel ID URL Precedence (Resmi Kanal ID URL Önceliği):**
  - Refactored `updateChannelFullInfo` and `fetchChannelSubscriberCount` in `server/routes/channels.js` to query YouTube's official, immutable `https://www.youtube.com/channel/${channel.id}` URL as primary (Option 1), falling back to `@handle` URLs only if needed (Option 2).
  - Eliminates false-positive `"Orijinal ve proxy sunucuları üzerinden ... adresi çekilemedi"` warnings and guarantees faster metadata retrieval on first attempt.
  - Kanal abone ve avatar çekimlerinde tahmin edilen/geçersiz olabilen handle adresleri yerine doğrudan YouTube'un resmi UC kanal ID adresi 1. birincil kaynak yapıldı; handle adresi 2. yedek seçenek konumuna getirildi.

- **Optimized Single Gist Backup & 5-Second Debounce (Toplu Güncellemede Tekil Gist Senkronizasyonu & Debounce):**
  - Removed per-iteration `writeDb(db)` calls from `update-all-info` in `server/routes/channels.js`.
  - Added a 5-second debounce buffer to `triggerAutoGistSync` in `server/routes/gist.js` so rapid database/INI updates coalesce into a single, efficient GitHub Gist push after batch operations complete.
  - Toplu kanal güncellemelerinde her kanalda ayrı ayrı Gist API çağrısı yapılması engellendi, tüm işlem bittiğinde tek seferde yedekleme yapılması ve 5 saniyelik debounce koruması sağlandı.

## [8.28.0] - 2026-08-14

### Major Bug Fixes & Concurrency Safeguards / Kritik Hata Düzeltmeleri & Eşzamanlılık Korumaları

- **RSS Live/Upcoming Stream Conversion Deadlock Fix (Canlı/Yaklaşan Yayın Dönüşümü Deadlock Düzeltmesi):**
  - Resolved a critical deadlock bug in `checkAllChannelsRssParallel` and `checkPendingLiveStreams` (`server/services/rss.js`).
  - Previously, when an upcoming or live stream completed and converted into a playable VOD video, `downloadQueue.add` was invoked while holding the FIFO mutex lock from `acquireDbLock()`. Because `downloadQueue.add` in `downloader.js` also requests `acquireDbLock()`, the thread deadlocked indefinitely, permanently hanging the RSS scanner and rejecting all subsequent timer-based checks with `[Kanal Kontrolü] Zaten devam eden bir RSS taraması var (Kaynak: timer). Yeni istek atlandı.`
  - Refactored DB write operations to release the mutex lock immediately before enqueuing videos to `downloadQueue.add`.
  - Canlı veya yaklaşan bir yayın normal videoya dönüştüğünde, `acquireDbLock()` mutex kilidi tutulurken `downloadQueue.add` çağrılması nedeniyle oluşan karşılıklı kilitlenme (deadlock) giderildi. Veritabanı güncellemesi yapılıp kilit serbest bırakıldıktan sonra video indirme kuyruğuna güvenle aktarılacak şekilde mimari refaktör edildi.

- **Stale RSS Scan Watchdog & Automatic Lock Recovery (Askıda Kalan RSS Taraması Bekçi Mekanizması):**
  - Added `rssCheckStartTime` timestamp tracking to `triggerChannelCheck` in `server/services/rss.js`.
  - If an RSS channel scanning cycle unexpectedly hangs or exceeds 5 minutes (300 seconds), the lock is automatically reset with a console/terminal warning, allowing subsequent automated background timer checks to resume uninterrupted.
  - Arka plan RSS taramasının beklenmedik harici ağ/sistem gecikmeleri nedeniyle 5 dakikadan (300 sn) uzun süre askıda kalması durumunda kilidin otomatik sıfırlanması ve zamanlayıcı döngüsünün kesintisiz devam etmesi sağlandı.

- **Database Mutex 30-Second Timeout Safety Guard (Veritabanı Mutex 30 Saniye Zaman Aşımı Koruması):**
  - Added an automatic 30-second `Promise.race` timeout guard to `acquireDbLock()` in `server/database.js`.
  - Ensures no asynchronous database write operation can permanently freeze or deadlock the application event loop under any circumstance.
  - `server/database.js` içindeki `acquireDbLock()` sıralı kilit mekanizmasına 30 saniyelik zaman aşımı emniyeti eklendi.

## [8.27.0] - 2026-08-14

### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **YouTube HTTP 403 / 503 Anti-Bot Throttling Bypass & Multi-Client Engine (YouTube 403/503 Kısıtlama Bypass & Çoklu İstemci Motoru):**
  - Added `--geo-bypass` and player client extractor fallback parameters (`--extractor-args "youtube:player_client=android_vr,web,tv"`) to `yt-dlp` download commands in `server/services/downloader.js`.
  - Bypasses YouTube's regional restrictions, rate-limiting, and impersonation warning failures (`HTTP Error 403: Forbidden` and `HTTP Error 503: Service Unavailable`).
  - Implemented automatic 2-stage retry handler for transient HTTP 403 / 503 / 429 server errors before marking downloads as `failed`.
  - YouTube sunucularının geçici bot koruması veya oran kısıtlaması nedeniyle döndürdüğü HTTP 403 Forbidden ve HTTP 503 Service Unavailable engellerini aşmak için `--geo-bypass` ve çoklu istemci (`android_vr,web,tv`) parametreleri entegre edildi. Geçici 403/503/429 sunucu hatalarında 5 saniyelik 2 kademeli otomatik yeniden deneme motoru eklendi.

- **Library Queue Re-Add & Failed State Self-Healing (Kütüphane Yeniden İndirme & Hata Temizleme Düzeltmesi):**
  - Updated `downloadQueue.add` in `downloader.js` to automatically clear previous `error` messages, `retryCount` metrics, and `resolveAttempts` counters when re-queuing a video from the Library tab.
  - Ensures clicking "Yeniden İndirmeyi Dene" or re-downloading a video provides a pristine queue state without carrying over stale failure metadata.
  - Kütüphane sekmesinde "Yeniden İndirmeyi Dene" butonuna basıldığında veya bir video tekrar indirmeye alındığında eski hata mesajları, deneme sayacı ve metadata kalıntıları otomatik temizlenerek indirme sırasının takılmadan ve temiz bir şekilde sıfırdan başlatılması sağlandı.

## [8.26.0] - 2026-08-14

### Major Enhancements & Automation Rules / Ana Geliştirmeler & Otomasyon Kuralları

- **6-Hour Live Stream VOD Conversion Timeout & Background Scanning Guard (6 Saatlik Canlı Yayın VOD Dönüşüm Zaman Aşımı):**
  - Enhanced `checkPendingLiveStreams` and RSS background scan routines in `server/services/rss.js`.
  - YouTube live streams that have ended, become private, are members-only, or fail to convert into playable VOD videos within 6 hours are now automatically marked as `ignored` with an explicit reason (`"Canlı yayın 6 saat içinde VOD videoya dönüşmedi (Takipten çıkarıldı)"`).
  - Prevents ended or private live streams from lingering indefinitely in background RSS scan loops and metadata check queues.
  - Canlı yayın bittikten veya eklenmesinden sonra 6 saat içinde VOD videoya dönüşmeyen, gizliye alınan veya üyelere özel olan yayınlar arka plan tarama döngüsünden otomatik çıkarılarak `ignored` durumuna alınır.

- **0% Progress Stalling Guard & Just-Ended Live Stream Protection (%0 İndirme Takılma Koruması):**
  - Resolved an issue where newly ended live streams caused `yt-dlp` to get stuck indefinitely at `0.0%` progress due to unconditional `--live-from-start` flag usage.
  - `--live-from-start` is now conditionally restricted strictly to active streams (`duration === 'live'`).
  - Added an automatic 45-second 0% stall guard in `downloader.js`. If a download remains stuck at `%0` (e.g. while YouTube processes an ended live recording into a VOD), it automatically safely terminates the stalled `yt-dlp` process, transitions the video to `waiting_live_processing` status, and advances the download queue without blocking subsequent downloads.
  - Yeni biten canlı yayınların `--live-from-start` parametresi nedeniyle %0 seviyesinde kilitlenmesi engellendi. %0'da kalan indirmeler 45 saniye içinde otomatik tespit edilerek `waiting_live_processing` durumuna ertelenir ve kuyruğun ilerlemesi sağlanır.

## [8.25.0] - 2026-08-14

### Major Enhancements & UI Improvements / Ana Geliştirmeler & Arayüz İyileştirmeleri

- **Live Stream Scanning & Unplayable/Private Stream Handling (Canlı Yayın Denetleyici & Silinmiş/Gizli Yayın Koruması):**
  - Upgraded `fetchVideoDuration` and `checkPendingLiveStreams` in `server/services/rss.js` to detect deleted, private, member-only, or unavailable YouTube streams.
  - Unavailable videos are now automatically flagged as `ignored` with an explicit reason string, preventing infinite background metadata request loops.
  - Added a fail-counter (`liveCheckFailCount >= 3` or `age > 7 days`) for unresolvable live streams to clean up stale database entries automatically.
  - Eliminated repetitive terminal log spam during routine background live checks while preserving important status transition alerts (`CANLI` started, converted to VOD, or auto-ignored).
  - Canlı yayın denetim motoru geliştirildi. Silinmiş, gizli veya üyelere özel videolar otomatik tespit edilerek veritabanında `ignored` durumuna alınır ve sonsuz döngüler engellenir. Rutin tarama log kirliliği temizlendi.

- **Library Video Card "CANLI" Badge Redesign (Canlı Yayın Rozet Tasarımı):**
  - Removed explicit `"CANLI"` text label from video cards in the Library tab (`public/components/videoCard.js`).
  - Replaced with a pulsating neon-red status dot (`.status-dot-live animate-pulse`) featuring an interactive hover tooltip ("Canlı Yayın" / "Live Stream").
  - Kütüphane sekmesindeki video kartlarında düz "CANLI" metin etiketi kaldırılarak yerine sade, yanıp sönen neon kırmızı nokta ve üzerine gelindiğinde gözüken açıklama ipucu eklendi.

- **System Tray Console Window Improvements & Terminology Alignment (Tray Konsol Penceresi İyileştirmeleri):**
  - Enhanced `tray.cs` right-click System Tray context menu window ("Konsol Çıktısını Göster").
  - Documented core terminology: "Sistem Tepsi Menüsü", "Konsol Çıktısını Göster", "Konsol / Log Penceresi", and "CLI Komut Satırı".
  - Refactored `tray.cs` C# logging for live events and compiled `HaYTooL YT Downloader.exe`.

## [8.24.0] - 2026-08-14

### Major Enhancements & Script Fixes / Ana Geliştirmeler & Script Düzeltmeleri

- **Standardized Release Package Naming (`v8.X.Y HaYTooL YouTube Downloader.zip`):**
  - Updated `0nogithub/releases-maker.ps1` and `0nogithub/publish_release.ps1` to generate ZIP packages using the standardized version-prefixed format (`v8.X.Y HaYTooL YouTube Downloader.zip`).
  - Sıkıştırma ve paketleme scriptleri güncellendi. Artık son kullanıcı için üretilen portable ZIP paket isimleri standart olarak sürüm numarasını en başa alarak (`v8.X.Y HaYTooL YouTube Downloader.zip`) oluşturulmaktadır.

- **Multi-Version Cumulative Changelog Parser (`publish_release.ps1`):**
  - Upgraded the release notes extraction algorithm in `publish_release.ps1` (`Get-ReleaseNotesFromChangelog`). Previously, it only extracted notes for a single version header and stopped. Now it dynamically detects the previous published Git tag and aggregates **all intermediate unreleased version sections** (e.g. 8.20, 8.21, 8.22, 8.23, 8.24) into the GitHub release description so no release notes are omitted.
  - Release yayınlama scripti (`publish_release.ps1`) içindeki `CHANGELOG` ayrıştırma motoru geliştirildi. Artık sadece tek bir versiyon başlığını değil, son yayınlanan GitHub tag'inden bu yana yazılmış tüm ara sürümlerin değişiklik notlarını eksiksiz bir şekilde toplayarak GitHub Release açıklamasına ekler.

- **Live Stream Scanning Console Log & Custom Neon Color (Canlı Yayın Denetimi Renkli Konsol Logları):**
  - Added dedicated `[CANLI YAYIN]` terminal logging to `checkPendingLiveStreams` in `server/services/rss.js`.
  - Updated `tray.cs` with custom **Neon Teal (`#00FFC8`)** color formatting for `[CANLI]` / `[CANLI YAYIN]` lines in the "Konsol Çıktısını Göster" window and recompiled `HaYTooL YT Downloader.exe`.
  - Excluded hidden, ignored, and completed items from the live stream pending queue to eliminate ghost scanning.
  - Canlı yayın denetimleri için `[CANLI YAYIN]` etiketiyle konsola anlık bilgi aktarımı eklendi. `tray.cs` içinde bu loglar için özel **Neon Camgöbeği (`#00FFC8`)** renk vurgusu tanımlandı ve C# tepsi uygulaması derlendi. Gizli, yoksayılan ve indirilmiş ögeler süzgeçten çıkarılarak hayalet taramalar engellendi.

- **Automated Restricted Channel Scanner & Bypass Engine (Yasaklı/Kısıtlamalı Kanal Bypass Motoru):**
  - Introduced a 3-tier fallback scanner (`fetchRestrictedChannelVideos`) in `server/services/rss.js` for regional/age-restricted or blocked YouTube channels:
    1. **Geo-Bypass & TV/Android Client:** Runs `yt-dlp` with `--geo-bypass`, `--geo-bypass-country US`, and `--extractor-args "youtube:player_client=android,tv_embedded;lang=tr"`.
    2. **Invidious/Piped Mirror RSS Gateways:** Queries independent mirror RSS XML streams (`yewtu.be`, `invidious.nerqv.ps`, `inv.tux.pizza`, `vid.puffyan.us`) via proxy waterfall.
    3. **Proxy Waterfall HTML Scraper:** Extracts video IDs from YouTube's `ytInitialData` structure.
  - Added custom **Kehribar Amber (`#FF9600`)** color highlight for `[YASAKLI KANAL]` terminal logs in `tray.cs`.
  - Bölgesel engel veya kısıtlama içeren kanalların taranabilmesi için 3 katmanlı otomatik bypass motoru (`fetchRestrictedChannelVideos`) geliştirildi. Sırasıyla Geo-Bypass & Android TV client taklidi, alternatif Invidious/Piped ayna beslemeleri ve Proxy HTML ayrıştırıcısı devreye girer. `tray.cs` konsol penceresine Kehribar Turuncusu renk vurgusu eklendi.

- **Scan Mode Indicator in Console Logs (Seçili Tarama Modu Konsol İfadesi):**
  - Added explicit scan mode indication (e.g. `⚡ Hızlı Tarama (XML RSS)` vs `🐢 Klasik Tarama (yt-dlp)`) to channel scanning start, trigger source, and completion log messages in the console. Fixed a scope issue where `readDb()` was missing in `triggerChannelCheck`.
  - Ayarlardan seçilen tarama modu (Hızlı/XML RSS veya Klasik/yt-dlp) kanal taraması başladığında, tetiklendiğinde ve tamamlandığında konsol loglarında açıkça görünür kılındı. `triggerChannelCheck` içindeki scope tanım hatası giderildi.

- **Default Initial Channels Update (Varsayılan Başlangıç Kanalları Güncellemesi):**
  - Added `@HaYToKoRaZ` (`HaYTo KoRaZ`) channel to `defaultDb` alongside `@TeknoSeyir`. Newly initialized database files will come pre-populated with both channels out of the box with `autoDownload: false`.
  - Veritabanının sıfırdan oluşturulduğu ilk açılışta varsayılan olarak gelen kanallar listesine `@TeknoSeyir` kanalının yanına `@HaYToKoRaZ` kanalı eklendi. İlk kurulumlarda iki kanal da hazır ve tanımlı olarak gelecektir.

## [8.23.0] - 2026-08-14


### Bug Fixes & UI Fixes / Hata Düzeltmeleri & Arayüz İyileştirmeleri

- **SponsorBlock Persistence Across Page Refreshes (SponsorBlock Ayarının Kalıcılığı):**
  - Toggling SponsorBlock via the in-player shield button now saves the `sponsorBlockEnabled` setting directly to the backend database (`/api/settings`) and syncs with the Settings tab toggle. Disabling SponsorBlock now persists across page refreshes (F5) and new video loads.
  - Oynatıcı içerisindeki kalkan butonuna basıldığında SponsorBlock ayarı doğrudan backend veritabanına kalıcı olarak kaydediliyor. Sayfa yenilendiğinde (F5) veya yeni video açıldığında ayarın sıfırlanıp tekrar açılması hatası giderildi.

- **Progress Bar Marker Full Opacity (İlerleme Çubuğu İşaretçilerinde Canlı Opaklık):**
  - Removed the `opacity: 0.15` reduction on timeline segment markers (`.player-sponsor-markers-wrapper`). SponsorBlock markers on the progress bar now remain 100% full opacity (vivid colors) at all times, even when SponsorBlock auto-skipping is toggled off.
  - İlerleme çubuğundaki renkli SponsorBlock segment işaretçilerinde uygulanan soluklaştırma (`opacity: 0.15`) kaldırıldı. İşaretçiler SponsorBlock kapatıldığında da daima %100 opaklıkta ve canlı renklerde görünür; yalnızca otomatik atlama devre dışı kalır.

## [8.22.0] - 2026-08-13


### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **Guaranteed Live Broadcast & Replay Download Enforcement (`--live-from-start` & 4x Parallel Fragment Engine):**
  - **Live-From-Start Enforcement:** Fixed a critical issue where downloading YouTube live streams or past live broadcasts (replays like `sPXrrYLPC2M`) failed with `fragment not found` errors due to YouTube's default sliding 2-hour DVR manifest window. Enforced `--live-from-start` across all downloads, ensuring yt-dlp fetches live stream manifests starting from segment 1 (0th second of the broadcast) to the end. Safe and transparent for normal non-live videos.
  - **4x Parallel Fragment Accelerator:** Added `--concurrent-fragments 4` and `--hls-use-mpegts` flags to yt-dlp arguments, allowing 1,600+ DASH/HLS segments to be fetched in 4 concurrent parallel streams, increasing download speeds by 4x.
  - **Canlı Yayın Tekrarı Sıfırdan İndirme Garantisi (`--live-from-start`):** Canlı yayınların ve canlı yayın tekrarlarının (VOD) YouTube'un 2 saatlik kayan DVR penceresi yüzünden ilk parçalarda `fragment not found` hatası verip takılması engellendi. `--live-from-start` bayrağı eklenerek yayın ne kadar uzun olursa olsun en başından (0. parçadan) itibaren eksiksiz indirmesi sağlandı.
  - **4 Kat Hızlı Paralel Parça İndirme:** `--concurrent-fragments 4` ve `--hls-use-mpegts` eklenerek 1.600+ parçalı canlı yayınların 4 paralel kanaldan çekilmesi sağlandı; indirme hızı 4 katına çıkarıldı.

## [8.21.0] - 2026-08-13

### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **Queue Engine Self-Healing & Instant Reset (İndirme Motoru Otomatik İyileştirme & Anında Sıfırlama):**
  - **Zero-Restart Queue Resilience:** Resolved an issue where lingering zombie download processes or stuck `activeDownloads` counters blocked subsequent downloads, previously forcing application restarts. Re-adding a video now automatically kills stale process locks for that ID, and `downloadQueue.process()` auto-heals dead process entries.
  - **"Reset Download Engine" Action Button:** Added a new button and `POST /api/queue/reset-engine` API endpoint allowing users to forcefully reset download engine process locks, clear active process counters, and re-trigger queue processing instantly without restarting `server.js`.
  - **Süreç Kilitlerinin ve Takılmalarının Önlenmesi:** İndirme kuyruğunda askıda kalan zombi süreçlerin ve `activeDownloads` sayacının sonraki indirmeleri kilitlediği ve uygulamaya restart atma zorunluluğu getirdiği sorun giderildi. Tekrar indirilen videolarda eski askıdaki süreçler otomatik sonlandırılır ve `process()` metodu ölmüş süreçleri haritadan otomatik temizler.
  - **"İndirme Motorunu Sıfırla" Butonu & API:** Arayüze ve API'ye tüm süreç kilitlerini temizleyip motoru anında yeniden başlatan "Motoru Sıfırla" butonu eklendi.

- **Live Stream Replay & HLS Fragment Download Recovery (Canlı Yayın Tekrarı & HLS Parça İndirme Düzeltmesi):**
  - **Ended Live Broadcast VOD Duration Fix:** Resolved a bug in `parseDurationFromHtml()` where YouTube's `isLiveContent: true` metadata flag caused finished live stream broadcasts (replays) to be falsely categorized as `duration = 'live'`, trapping them in `waiting_live_processing` mode. Ended live replays with valid non-zero durations are now parsed correctly as standard VODs (`H:MM:SS`).
  - **HLS/DASH Fragment Retries & Live Progress Tracking:** Updated yt-dlp `--fragment-retries` to `3` with `--skip-unavailable-fragments` and added real-time DASH fragment progress parsing (`Fragment X of Y`, `~186MB`), ensuring live stream replays show real-time percentage progress bar movements (`10.5%`, `164/1618 Parça`) instead of appearing stuck at 0%.
  - **Orphan Fragment Cleanup:** Automatically cleans unmerged `.f137.mp4`, `.f140.m4a`, and `.part` files prior to restarting a download, ensuring FFmpeg merges clean audio and video into a single output file.
  - **Bitmiş Canlı Yayın Tekrarı Ayrıştırma Düzeltmesi:** YouTube'un `isLiveContent: true` etiketinin bitmiş yayın tekrarlarında da gelmesi nedeniyle videoların sonsuz `live` modunda kalması düzeltildi. Bitmiş yayınlar gerçek süreleriyle (`H:MM:SS`) ayrıştırılarak indirmeye açık hale getirildi.
  - **DASH Parça Canlı İlerleme Çubuğu:** Live stream tekrarlarındaki 1600+ parçalı indirme sürecinde arayüzde ilerlemenin %0 kalması engellendi. Gerçek zamanlı parça takibi (`%10.5`, `164/1618 Parça`) ve tilde (`~`) boyut desteği eklendi.

## [8.20.2] - 2026-08-13

### Bug Fixes / Hata Düzeltmeleri

- **SponsorBlock: Markers Now Always Full Opacity (İşaretler Artık Hep Tam Opaklıkta):**
  - Fixed an issue where, if the user had previously toggled the in-player SB button (`sponsorBlockTemporarilyDisabled = true`) and then disabled SponsorBlock globally, the `sponsorBlockTemporarilyDisabled` state was never reset. When a new video was opened, `updateSBToggleButtonUI` saw the stale `true` value and applied `opacity: 0.15` to all marker wrappers.
  - Added an `else` branch in the player initialization block: when `sponsorBlockEnabled` is `false`, `sponsorBlockTemporarilyDisabled` is now explicitly reset to `false` and `updateSBToggleButtonUI` is called, ensuring markers always render at full opacity regardless of the global toggle state.
  - Önceki videoda geçici devre dışı bırakma (`sponsorBlockTemporarilyDisabled = true`) yapıldıktan sonra global ayar kapatılırsa, yeni video açılışında state sıfırlanmıyordu ve işaretler `opacity: 0.15` ile silik görünüyordu. `else` bloğu eklenerek her video açılışında state sıfırlanır hale getirildi; işaretler artık her zaman tam opaklıkta görünür.

## [8.20.1] - 2026-08-13


### Bug Fixes / Hata Düzeltmeleri

- **SponsorBlock: Markers Always Visible, Auto-Skip Respects Setting (İşaretler Her Zaman Görünür, Otomatik Atlama Ayara Bağlı):**
  - Previously, disabling SponsorBlock in Settings caused both the timeline markers and auto-skip to disappear. Now `fetchSponsorSegments` and `drawSponsorSegmentsOnTimeline` always run regardless of the setting — yellow/green/colored segment markers are always drawn on the progress bar. Only `checkAndSkipSponsor` checks the `sponsorBlockEnabled` flag, so auto-skipping is disabled when toggled off but visual markers remain.
  - Daha önce Ayarlar'dan SponsorBlock kapatıldığında ilerleme çubuğundaki renkli işaretler de kayboluyor ve veriler hiç çekilmiyordu. Artık segment verileri ve çizgiler her zaman yükleniyor; sadece otomatik atlama (`checkAndSkipSponsor`) ayarı kontrol ediyor. Ayar kapalıyken işaretler görünmeye devam eder, yalnızca otomatik atlama devre dışı kalır.

## [8.20.0] - 2026-08-13


### Bug Fixes & UI Improvements / Hata Düzeltmeleri & Arayüz İyileştirmeleri

- **Settings: Alt Thumbnail Hover Toggle Fix (Alternatif Kapak Döngüsü Düzeltmesi):**
  - Fixed a bug where toggling "Alternatif Kapak Döngüsü" in Settings had no effect. The `enableAltThumbnailsHover` value was never included in the `saveSettings()` payload sent to the backend, causing the setting to always reset to its default value.
  - Ayarlar sekmesindeki "Alternatif Kapak Döngüsü" toggle'ının hiçbir etkisinin olmadığı hata giderildi. `enableAltThumbnailsHover` değeri `saveSettings()` objesinde eksikti, bu nedenle değişiklik backend'e hiç gönderilmiyordu.

- **Settings: Global Shorts Duration Limit UI Added (Global Shorts Süresi Sınırı Arayüzü Eklendi):**
  - Added a visible input field `#settings-shortsdurationlimit` to the Settings tab under "Otomasyon & RSS". Previously, the `shortsDurationLimit` value was used in backend RSS scanning logic but had no UI input—it was always silently fixed at 180 seconds. Now users can configure the global Shorts threshold directly.
  - Ayarlar sekmesi "Otomasyon & RSS" bölümüne `shortsDurationLimit` (Shorts Süresi Sınırı) giriş alanı eklendi. Bu değer backend RSS tarama mantığında kullanılıyordu ancak UI'da görünmüyordu ve her zaman 180 saniye olarak sabit kalıyordu. Artık kullanıcılar global Shorts eşiğini doğrudan ayarlayabilir.

- **Settings: History Limit Label Clarified (Geçmiş Videosu Sınırı Etiketi Düzeltildi):**
  - Renamed "Geçmiş Videosu Sınırı" → "Kütüphane Görüntüleme Sınırı" with updated description clarifying this is a UI display cap, not a database record limit.
  - "Geçmiş Videosu Sınırı" etiketi, "Kütüphane Görüntüleme Sınırı" olarak yeniden adlandırıldı ve açıklama metni güncellendi.

## [8.19.0] - 2026-08-13


### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **Live Stream & Premiere Smart Download & Bandwidth Protection (Canlı Yayın & Prömiyer Akıllı İndirme Yönetimi):**
  - **Zero-Bandwidth Metadata Check (~2KB):** Checks YouTube live stream processing status using lightweight metadata queries (`~2KB`), consuming 0 video bandwidth until YouTube converts live recordings into processed VOD videos.
  - **3 Multilingual Handling Modes in Settings:** Added user setting for Live Stream Handling (`instant_retry` "Anında İndir & Otomatik Tekrar Dene", `vod_only` "Sadece İşlenmiş VOD İçerikleri İndir", `ignore_live` "Canlı Yayınları İndirme / Gösterme").
  - **Configurable Retry Interval:** Added setting to set auto-retry interval (15, 30, 45, 60 mins; default **30 minutes**).
  - **Sleek Icon-Only Yellow Badge + Hover Tooltip:** Displays a yellow icon badge (🟡) in history/library lists without cluttering UI text, showing status details on mouse hover across all 7 supported languages.
  - **FFmpeg Local Directory Enforcement & Multi-Mirror Downloader:** Fixed `fetch failed` error by adding multi-mirror CDN fallback and restricted FFmpeg detection strictly to app local `ffmpeg/` directory.
  - **"The downloaded file is empty" Post-Live Protection:** Added auto-detection for YouTube Post-Live Manifestless `0-byte` empty file errors, automatically placing pending YouTube VOD streams into `waiting_live_processing` mode with zero-bandwidth smart background retries.

## [8.18.0] - 2026-08-12

### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **Unified System Database & Settings Backup Architecture (Birleştirilmiş Sistem Veritabanı & Ayar Yedekleme Mimarisi):**
  - **Single Unified UI Section:** Replaced 3 fragmented backup sections in Settings tab with a single unified card ("Sistem Veritabanı & Ayar Yedekleme").
  - **Complete 5-File System Bundle:** Backs up `db.json`, `channels.ini`, `categories.ini`, `configwin.ini`, and `configunix.ini` so zero settings or channel data are lost after reformatting.
  - **Built-In Zlib Compression (`.json.gz`):** Utilized Node.js native `zlib` compression to achieve 80%+ file size reduction without external npm bloatware.
  - **Rolling Backup Retention & Daily Protection:** Enforced a max limit of 10 backups in `backup/` directory with automatic protection (`isDailyProtected`) for the first backup of each calendar day.
  - **Online & Offline Restore Flexibility:** Supports 1-click restore from local compressed backup list, uploading local `.json.gz` / `.zip` backup files, or pulling complete system backups online via GitHub Gist.

## [8.17.0] - 2026-07-30

### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **CachyOS (Arch Linux) & Windows 11 Dual-Boot Cross-OS Full Compatibility (Çift İşletim Sistemi Tam Uyumluluk):**
  - **Shared Download Path & Database Integrity:** Video history and disk file verification dynamically resolves file paths across Windows (`D:\...`) and CachyOS (`/mnt/...` or `/run/media/...`), ensuring zero missing files and seamless playback on both operating systems.
  - **Side-by-Side Binary Architecture (Option B):** Supported placing Windows binaries (`yt-dlp.exe`, `ffmpeg.exe`) and Linux binaries (`yt-dlp`, `ffmpeg`) side-by-side in `yt-dlp/` and `ffmpeg/` folders.
  - **Automatic `chmod +x` & GitHub Linux Engine Updating:** Added automatic execution permission (`chmod +x`) for Linux binaries on startup and updated the UI "yt-dlp Güncelle" button to download the latest official Linux binary if missing.
  - **Universal Linux File Manager Opener (`xdg-open`):** Transformed "Open Folder" and "Open File Location" endpoints to support universal Linux desktop environments (`xdg-open` / `dolphin`) without hardcoded Windows `explorer.exe` dependencies.
  - **OS-Aware Python Command Fallback:** System defaults to `python3` on Linux/CachyOS and `python` on Windows in database and process spawns.
  - **CachyOS Standalone App Mode (`baslat.sh`):** Enhanced `baslat.sh` to automatically detect CachyOS/Linux browsers (`cachy-browser`, `chromium`, `chrome`, `brave`, `zen-browser`, `microsoft-edge`) and launch HaYTool in standalone App Mode (`--app=http://localhost:4141`) without tabs or address bars.
  - **DeArrow Alternative Thumbnail Hover Cycling:** Added interactive video thumbnail hover cycling through official YouTube/DeArrow frame snapshots (`1.jpg`, `2.jpg`, `3.jpg`) with a toggle switch in Settings.
- **Strict Compliance & Automatic Backup:**
  - Verified project constitution (`clinerules.md`) and generated automated 7z backup (`HaYTooL_Yedek_2026-07-30_22-52.09.7z`).

## [8.16.0] - 2026-07-30

### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **Universal Theme-Adaptive Toast Notification System (Tüm Bildirimler İçin Temalara Tam Uyumlu Toast Sistemi):**
  - Updated all toast notifications (`info`, `success`, `error`, `warning`) generated across the app (video downloading, completed, deleted, channel updates, metadata refresh, queue actions, system errors) to automatically match the active color theme.
  - Custom palette overrides implemented across all 5 themes (**Dark**, **Light**, **Matrix**, **Discord**, **YouTube**):
    - **Dark Theme:** Signature Neon Purple (`#8a2be2`) glow, dark glassmorphism card background, themed icon badges.
    - **Light Theme:** Pristine white background (`#ffffff`), Sky Blue (`#0ea5e9`) info border, Green (`#16a34a`) success, Red (`#dc2626`) error, Amber (`#d97706`) warning.
    - **Matrix Theme:** Deep cyber black background (`rgba(2, 10, 3, 0.96)`), Cyber Green (`#00ff41`) info/success border & glow, Bright Red (`#ff3333`) error, Yellow (`#ffff00`) warning.
    - **Discord Theme:** Discord Charcoal background (`rgba(43, 45, 49, 0.96)`), Blurple (`#5865f2`) info border, Discord Green (`#57f287`) success, Discord Red (`#ed4245`) error, Discord Yellow (`#fee75c`) warning.
    - **YouTube Theme:** YouTube Obsidian background (`rgba(24, 24, 24, 0.96)`), Iconic Red (`#ff0000`) info/error border, Forest Green (`#2ba640`) success, Gold (`#fbc02d`) warning.
  - Added explicit `toast.toast-warning` styling and `alert-circle` icon support in `toast.js`.
- **Strict Compliance & Automatic Backup:**
  - Verified project constitution (`clinerules.md`) and generated automated 7z backup (`HaYTooL_Yedek_2026-07-30_03-59.35.7z`).

## [8.15.0] - 2026-07-30

### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **Discord & YouTube Authentic Themes Addition (Discord ve YouTube Özel Temaları):**
  - Added authentic **Discord Theme** (`discord-theme`) featuring Discord's iconic Blurple (`#5865f2`), Charcoal dark bg (`#313338`), and Discord green (`#57f287`) accents.
  - Added authentic **YouTube Theme** (`youtube-theme`) featuring YouTube's iconic Obsidian Black bg (`#0f0f0f`) and Red (`#ff0000`) glowing highlights.
  - Updated `#quick-theme-toggle-btn` to cycle through 5 themes sequentially (**Dark -> Light -> Matrix -> Discord -> YouTube -> Dark**) with dynamic Lucide icons (`moon` 🌙, `sun` ☀️, `terminal` 💻, `message-square` 💬, `play-circle` ▶️).
  - Added `opt_theme_discord` and `opt_theme_youtube` translation keys across all 7 supported language files (`tr`, `en`, `de`, `es`, `pt`, `ru`, `ar`).
- **Strict Compliance & Automatic Backup:**
  - Verified project constitution (`clinerules.md`) and generated automated 7z backup (`HaYTooL_Yedek_2026-07-30_03-48.15.7z`).

## [8.14.0] - 2026-07-30

### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **Tools Dropdown Purple Theme Harmonization (Araçlar Açılır Menüsü Mor Tema Uyumu):**
  - Updated `.nav-dropdown-menu`, `.nav-dropdown-item`, `.nav-dropdown-header`, `.nav-item-icon-box`, and `.nav-dropdown-badge` in default Dark Theme to use signature neon purple (`#8a2be2` / `var(--primary)`) instead of legacy cyan accents.
  - Araçlar menüsünün açılır paneli (`#tools-menu`), başlık şeridi, kart kenarlıkları, ikon kutuları ve hover efektleri tamamen neon mor renge dönüştürüldü.
- **Strict Compliance & Automatic Backup:**
  - Verified project constitution (`clinerules.md`) and generated automated 7z backup (`HaYTooL_Yedek_2026-07-30_03-41.30.7z`).

## [8.13.0] - 2026-07-30

### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **Settings Layout Restructuring (Ayarlar Düzeni Güncellemesi):**
  - Moved the `#subtab-automation` ("Otomasyon & RSS") card from Column 1 into Column 2 (`div.settings-column:nth-of-type(2)`), creating a balanced, clean 2-column layout.
  - Ayarlar sekmesindeki "Otomasyon & RSS" kartı 2. sütuna taşınarak sağ tarafa alındı ve sayfa düzeni dengelendi.
- **Dark Theme Navigation Bar Harmonization (Koyu Tema Üst Menü Renk Uyumu):**
  - Converted navigation menu buttons (`.nav-item`, `.tools-btn`) in the default Dark Theme from cyan/blue accents to the system's signature neon purple (`var(--primary)` / `rgba(138, 43, 226, ...)`).
  - Varsayılan Koyu Tema üst navigasyon menüsü mavi tonlarından arındırılarak sistem genelindeki cam neon mor (`#8a2be2`) estetiği ile %100 uyumlu hale getirildi.
- **Strict Compliance & Automatic Backup:**
  - Verified project constitution (`clinerules.md`) and generated automated 7z backup (`HaYTooL_Yedek_2026-07-30_03-37.46.7z`).

## [8.12.0] - 2026-07-30

### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **Matrix Theme Addition (Matrix Siber Yeşil Teması):**
  - Added new high-contrast Cyberpunk **Matrix Theme** (`matrix-theme`) with glowing neon green (`#00ff41`), glassmorphic dark emerald background (`#020803`), custom cyber borders (`rgba(0, 255, 65, 0.22)`), and high-contrast pale text (`#e0ffe6`).
  - Uygulamaya özel siber yeşil fosfor detaylarına sahip yüksek kontrastlı **Matrix Teması** eklendi.
- **3-Way Theme Cycle (3 Yönlü Hızlı Tema Döngüsü):**
  - Updated `#quick-theme-toggle-btn` to cycle through **Dark -> Light -> Matrix -> Dark** sequentially with dynamic Lucide icons (`sun` ☀️, `terminal` 💻, `moon` 🌙) and toast notifications.
  - Hızlı tema değiştirme butonu **Koyu -> Açık -> Matrix -> Koyu** şeklinde 3 temalı döngüsel geçiş yapacak şekilde güncellendi.
- **Multi-Language (i18n) Support Across All 7 Languages:**
  - Added `opt_theme_matrix` translations to all 7 language files (`tr`, `en`, `de`, `es`, `pt`, `ru`, `ar`).
  - 7 dilde Matrix Teması seçenek metinleri tanımlandı.
- **Strict Compliance & Automatic Backup:**
  - Verified project constitution (`clinerules.md`) and generated automated 7z backup (`HaYTooL_Yedek_2026-07-30_03-31.19.7z`).

## [8.11.0] - 2026-07-30

### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **Quick Theme Toggle Button (Hızlı Tema Değiştirme Butonu):**
  - Added `#quick-theme-toggle-btn` to the top status badges bar (`.topbar-status-badges`) right next to `#open-downloads-folder-btn`.
  - Enables 1-click instant switching between **Dark Theme (Karanlık)** and **Light Theme (Aydınlık)** with dynamic sun/moon icons, tooltip updates, and server settings persistence (`/api/settings`).
  - Üst bardaki İndirilenler Klasörünü Aç butonunun hemen sağına hızlı Koyu/Açık tema değiştirme düğmesi eklendi. Tek tıkla canlı tema değişimi sağlandı.
- **Portable Packaging Script Exclusion Audit (`releases-maker.ps1`):**
  - Audited and updated `0nogithub/releases-maker.ps1` folder exclusions (`.vs`, `.vscode`) and file exclusions (`*.pdb`, `*.tmp`, `*.bak`).
  - Taşınabilir dağıtım paketi hazırlayıcı script güncellenerek debug sembolleri (*.pdb) ve geçici dosyaların otomatik dışlanması sağlandı.
- **Strict Compliance & Automatic Backup:**
  - Verified project constitution (`clinerules.md`) and successfully generated automated compressed backup (`HaYTooL_Yedek_2026-07-30_03-23.46.7z`).

## [8.10.0] - 2026-07-29

### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **Library Filter Chip System (Kütüphane Filtre Hap Butonları Sistemi):**
  - Converted all 5 bulky toggle switches in the Library (`#tab-history`) toolbar (Shorts, Canlı, Oto İndirme Kapalı, İndirilmeyenler, Gizlenenler) into modern, compact **Filter Chip Buttons** (`.filter-chip-btn`).
  - Added CSS styling with rounded pill borders, hover elevation, and a cyan glow effect when activated (`.filter-chip-btn.active`).
  - Integrated `toggleFilterChip()` and `syncFilterChipUI()` in `app.js` to seamlessly sync with existing settings and filter logic.
  - Kütüphane sekmesindeki 5 adet çok yer kaplayan toggle switch ögesinin tamamı (Shorts, Canlı, Oto İndirme Kapalı, İndirilmeyenler, Gizlenenler) modern, ikonlu ve aktifleştiğinde turkuaz fosforlu parlayan **Filtre Hap Butonlarına** dönüştürüldü. Toolbar araç çubuğu %60 daha kompakt bir görünüme kavuşturuldu.
- **Modern Tab Header Showcase (Kütüphane, İndirilenler, IPTV, Kuyruk, Kanallar & Araçlar Sekme Başlıkları):**
  - Applied the user-preferred **Tactical Cyber Glassmorphic Capsule** design system across all top navigation header tabs (`.nav-item` & `.tools-btn`).
  - Integrated cyan neon borders (`var(--secondary)`), glassmorphic backdrop blur, interactive icon hover animations, and vibrant active gradient glow.
  - Updated **Kütüphane** tab icon from `history` to `library` (media vault icon) while retaining its smooth rotation/scaling micro-animation on hover.
  - Fixed topbar CSS syntax error (removed stray semicolon) and unified fixed height (`38px`) across both tab buttons and right-side status badges (**Kalite**, **Boş Alan**, **Çerez**, **Bağlantı**), forcing strict pixel-perfect single horizontal line alignment without vertical offsets or line breaks.
  - Redesigned the **Araçlar Dropdown Menu Panel** into a premium Cyber Glassmorphic Control Panel with a glowing top accent bar (`::before`), header badge (`HIZLI ARAÇLAR PANELİ`), rounded icon boxes (`.nav-item-icon-box`), micro-badge capsules, spring pop-down animations, and left-accent neon hover highlights.
  - Full dynamic **Light & Dark Theme compatibility** across all navigation headers and dropdown elements.

## [8.9.0] - 2026-07-29

### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **Metadata Refresh Consolidation / Metadata Yenileme Birleştirmesi:**
  - Consolidated the metadata refresh feature into the **Downloaded (`#tab-downloaded`)** tab toolbar, enabling users to trigger backend duration & disk size (`fs.stat`) resolution directly from the "Metadata Güncelle" button.
  - Removed the redundant "Metadata Yenileme (Süre & Boyut)" card and header dropdown link from the **Tools** tab.
  - Added live spinner feedback on the Downloaded tab refresh button and automatic database view reload (`loadDb()`) upon completion.
  - Araçlar menüsündeki bağımsız "Metadata Yenileme (Süre & Boyut)" kartı ve üst menü seçeneği kaldırıldı. Bu işlevsellik doğrudan **İndirilenler (`#tab-downloaded`)** sekmesi toolbar'ındaki **"Metadata Güncelle"** butonuna bağlandı. Butona tıklandığında arka planda eksik süreler ve diskteki gerçek dosya boyutları taranarak güncellenmesi, canlı ikon ve veritabanı görünümü yenileme desteği sağlandı.

## [8.8.0] - 2026-07-29

### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **Inline Library Bulk Video Hiding Mode / Kütüphane İçi Toplu Video Gizleme Modu:**
  - Integrated bulk video hiding directly into the **Library (`#tab-history`)** tab toolbar as an inline feature with toggle button and selection bar, using the exact visual interaction design established in Downloaded Bulk Deletion mode.
  - Removed the standalone "Toplu Video Gizleme" tool card and dropdown navigation link from the **Tools** tab for a cleaner and more integrated workflow.
  - Supported selecting videos directly on cards/thumbnails, displaying cyan accent borders on selected items, updating selection counts in real time, and maintaining active Library filters during bulk operations.
  - Toplu video gizleme özelliği doğrudan **Kütüphane (`#tab-history`)** sekmesi toolbar'ına yerleşik (inline) bir mod olarak taşındı. İndirilenler sekmesindeki Toplu Silme modunun görsel ve etkileşim dili birebir uygulanarak toolbar'a "Toplu Gizle" butonu ve seçim barı eklendi.
  - Araçlar menüsündeki bağımsız "Toplu Video Gizleme" kartı ve dropdown bağlantısı kaldırıldı. Doğrudan Kütüphane kartları üzerinden tıklayarak seçim yapma, turkuaz vurgu çerçeveleri, canlı seçim sayacı ve mevcut Kütüphane filtrelerini koruyarak gizleme işlemini gerçekleştirme desteği sağlandı.

## [8.7.0] - 2026-07-29

### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **UI Streamlining & Navigation Bug Fix / Arayüz Sadeleştirme & Navigasyon Hata Düzeltimi:**
  - Removed the redundant subnavigation menu bar (`tools-subnav-bar`) from the Tools page, allowing users to control all tool sections cleanly and directly from the main header dropdown menu.
  - Fixed a direct tab navigation bug where clicking "Kanal Kategorilerini Düzenleme" (Channel Categories Edit) from the header dropdown menu would force-reset the view back to "Dosya Karşılaştırma" (File Comparison) due to tab visibility evaluations.
  - Set the "Delete files from disk" option to be checked by default when entering downloaded bulk delete mode.
  - Araçlar sayfasındaki gereksiz alt menü çubuğu (`tools-subnav-bar`) kaldırılarak arayüz sadeleştirildi. Üst araçlar menüsünden doğrudan ve tek noktadan yönlendirme yapılması sağlandı. Üst menüden "Kanal Kategorilerini Düzenleme"ye tıklandığında sekme görünürlük kontrolleri sebebiyle görünümün otomatik olarak "Dosya Karşılaştırma"ya sıfırlanması hatası giderildi.
  - İndirilenler sekmesindeki "Toplu Silme" moduna girildiğinde "Diskteki Dosyaları da Sil" seçeneğinin varsayılan olarak seçili gelmesi sağlandı.

## [8.6.0] - 2026-07-29

### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **Bulk Video Hiding / Toplu Video Gizleme:**
  - Added new "Toplu Video Gizleme" (Bulk Video Hiding) tool in both upper tools dropdown and Tools subnavigation tab.
  - Implemented backend API endpoint (`POST /api/history/bulk-hide`) to easily hide multiple videos at once from SQLite database.
  - Aligned bulk hiding video filter with Library tab filters (tracked channels, channel video limits, shorts rules, duration limits) to only list exact hideable videos currently visible in the user's Library.
  - Üst araçlar dropdown menüsüne ve Araçlar alt sekme navigasyon barına "Toplu Video Gizleme" seçeneği eklendi. Seçilen birden fazla videoyu SQLite veritabanında toplu olarak gizlemek için backend API uç noktası (`POST /api/history/bulk-hide`) ve arayüz entegrasyonu tamamlandı. Gizleme listesi, kullanıcının Kütüphane sekmesindeki tüm aktif filtreler ve kanal limitleri ile birebir eşitlenerek sayı ve içerik uyuşmazlığı giderildi.

## [8.5.0] - 2026-07-28

### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **Python Mode Resolution Quality Fix / Sistem Python Modunda Çözünürlük Hatası Düzeltilmesi:**
  - Removed restrictive `player_client=android,web_embedded` extractor arguments from all download commands in `downloader.js`, `routes/downloader.js` and `rss.js`.
  - Restored full resolution availability (1080p, 1440p, 4K etc.) under System Python mode by letting `yt-dlp` use its default client priority (e.g. `android_vr` which bypasses signature decryption challenges).
  - Sistem Python modunda videoların sadece 360p kalitesinde inmesine yol açan TV/Android istemci kısıtlaması kaldırıldı. `yt-dlp`'nin varsayılan istemci önceliklerine (örn. şifresiz veri sunan `android_vr`) geçişi sağlanarak 1080p, 2K ve 4K gibi tüm yüksek çözünürlüklerin başarıyla indirilmesi sağlandı.

- **Dropdown Menu Stacking Context Fix / Navigasyon Araçlar Menüsü Z-Index Düzeltmesi:**
  - Raised `.topbar` container `z-index` from `100` to `1000000` to prevent `.history-toolbar` (which has `z-index: 999999`) from overlapping the absolute navigation dropdown menu.
  - Üst gezinme çubuğu (`.topbar`) bileşeninin `z-index` değeri `100`'den `1000000` seviyesine yükseltilerek, Kütüphane ve İndirilenler sayfalarındaki filtre çubuğunun (`.history-toolbar`, `z-index: 999999`) açılan "Araçlar" menüsünün üstüne binmesi ve menüyü kapatması sorunu kesin olarak giderildi.


## [8.4.0] - 2026-07-28

### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **System Python execution & Proxy Waterfall improvements / Sistem Python'da Yürütme ve Proxy Waterfall Süre Çözümleme:**
  - Added new settings for "Duration Fetch Method" (`auto`, `waterfall`, `ytdlp`) and "yt-dlp Execution Mode" (`exe`, `python`) across all 7 language files.
  - Implemented automatic Proxy Waterfall in `rss.js` to fetch durations entirely in memory (RAM), fully protecting SSD life by eliminating temporary file writes.
  - Configured System Python run mode (`python -m yt_dlp`) in `paths.js` to run downloads and metadata tasks directly, completely avoiding Temp folder (`_MEI`) unpacking.
  - Added step-by-step setup guides (1-2-3 list formatting) under the Python command path setting.
  - Süre sorgulamalarında diske yazmayı sıfırlayan Proxy Waterfall (Vekil Sunucu) altyapısı ve video indirmelerinde SSD aşınmasını sıfırlayan Sistem Python çalıştırma modu entegre edildi. Arayüze Lucide ikonlarıyla ayarlar ve Python komut yolu için 1-2-3 adımlı Türkçe/İngilizce kurulum kılavuzu eklendi.

## [8.2.0] - 2026-07-24

### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **Multi-Language Audio & Title Localization / Çoklu Dil Videolarda Türkçe Ses Dublajı & Türkçe Başlık:**
  - Added HTTP `Accept-Language` headers, `youtube:lang` extractor arguments, `--format-sort`, and language-preferred audio format specifiers (`bestaudio[language^=lang]`) to `downloader.js`.
  - Automatically fetches localized Turkish titles, descriptions, and audio dubbing tracks for multi-language YouTube videos (e.g. Ruhi Çenet Documentaries, MrBeast).
  - Added "Preferred Audio & Title Language" (`preferredAudioLang`) configuration option to Settings tab across all 7 language files (`tr`, `en`, `es`, `de`, `pt`, `ar`, `ru`).
  - Çoklu dil ve dublaj seçeneği olan YouTube videolarında uygulamanın seçili diline uygun Türkçe başlık, açıklama ve Türkçe ses dublajı akışının otomatik indirilmesi sağlandı. Ayarlar sekmesine "Tercih Edilen Ses & Başlık Dili" ayarı eklendi.

## [8.1.0] - 2026-07-21

### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **Special Character URL Encoding in Player / Oynatıcıda Özel Karakterli Dosya Yolu URL Kodlaması:**
  - Added path segment `encodeURIComponent` handling in `playVideoModal` for local WebView2 video playback. Prevents Chromium/WebView2 from truncating URLs at `#` symbols (e.g. `#10`, `#Shorts`) and resolves 404 file not found errors in `HaYTooL-Player Beta.exe`.
  - WebView2 sanal dosya adresi oluşturulurken dosya yolu segmentlerine `encodeURIComponent` uygulandı. `#` ve `?` içeren videoların WebView2 yerel oynatıcısında kesilme ve 404 hatasına düşme sorunu giderildi.

- **Future Download Title Metadata Sanitization / Gelecek İndirmeler İçin Dosya İsmi Temizleme:**
  - Configured `--replace-in-metadata` yt-dlp arguments in `downloader.js` to strip `#`, `?`, `%` and sanitize `|` symbols in titles for future downloads while preserving native Turkish characters.
  - Gelecek indirmelerde yt-dlp motoruna özel karakter temizleme parametreleri (`--replace-in-metadata`) eklenerek yeni dosyaların isimlerindeki `#`, `?`, `%` simgeleri otomatik arındırıldı.

- **System Backup & Restore Categories Support / Sistem Yedeğine Kanal Kategorileri (`categories.ini`) Dahil Edilmesi:**
  - Updated `POST /api/settings/backup` and `POST /api/settings/restore` to bundle and restore `categories.ini` alongside `db.json`, `channels.ini`, and `configwin.ini`.
  - Manuel sistem yedekleme ve geri yükleme uç noktaları `categories.ini` dosyasını otomatik yedekleyecek ve geri yükleyecek şekilde güncellendi.

## [8.0.0] - 2026-07-21

### Major Features & Fixes / Ana Özellikler & Düzeltmeler

- **Tray Context Menu "Check Channels" Feature / Sistem Tepsisi "Kanalları Denetle" Menü Seçeneği:**
  - Added "Kanalları Denetle" (Check Channels) option to the system tray context menu in `tray.cs`, localized across 7 languages (`tr`, `en`, `es`, `de`, `pt`, `ar`, `ru`).
  - Triggers parallel RSS feed checks across all subscribed YouTube channels on demand via `POST /api/sync`.
  - Sistem tepsisindeki sağ tık menüsüne 7 dilde desteklenen "Kanalları Denetle" seçeneği eklendi. Tıklandığında tüm kanalların RSS akışları `POST /api/sync` uç noktası üzerinden anında paralel olarak taranır.

- **System Startup Tray Icon Visibility Fix / Sistem Açılışında Tepsi İkonu Kaybolma Hatası Düzeltmesi:**
  - Resolved missing tray icon issue when launched via Windows Run registry by binding working directory to `AppDomain.CurrentDomain.BaseDirectory` and using absolute `icon.ico` path.
  - Implemented `WM_TASKBARCREATED` message handler in `SyncMessageForm` to automatically restore notify icon visibility when Explorer.exe restarts or initializes.
  - Windows başlangıcında (`SOFTWARE\Microsoft\Windows\CurrentVersion\Run`) uygulamanın `C:\Windows\System32` varsayılan dizininde çalıştırılması nedeniyle ikon dosyasının okunamaması sorunu çalışma dizini sabitlemesi ve mutlak dosya yolu ile çözüldü. Windows görev çubuğu veya Explorer yeniden başladığında tepsiyi güncelleyen `WM_TASKBARCREATED` mesaj dinleyicisi eklendi.

- **Category Management Auto-Load Restoration / Araçlar Sekmesi Kategori Yönetimi Otomatik Yükleme:**
  - Integrated `loadCategoriesToTools` trigger upon switching to Tools tab (`switchTab('tools')`), rendering category manager cards with 17 default categories (including Podcast) fully localized and editable.
  - Araçlar sekmesine geçildiğinde (`switchTab('tools')`) Kategori Yönetimi tablosunun otomatik yüklenmesi ve tüm 17 kategorinin (Podcast dahil) canlı olarak listelenmesi sağlandı.

- **Channel Option Emoji Symbols / Filtre Listesi Kanal İkon Simgeleri:**
  - Restored visually distinct `📺 ` channel symbols and `📁 ` category symbols in filter selection dropdowns across History and Downloads views.
  - Kütüphane ve İndirilenler filtre listelerindeki seçeneklerin başına ayırt edici `📺 ` kanal ve `📁 ` kategori simgeleri eklendi.

- **Release Packaging Exclusion List Update / Dağıtım Paketi Hariç Tutma Listesi Güncellemesi:**
  - Updated `$ExcludeFolders` and `$ExcludeFiles` in `0nogithub/releases-maker.ps1` to filter out build artifacts, screenshots, releases, mutex locks, and log files (`screenshots`, `releases`, `mutex_lock.txt`, `iptv_cache.json`, `crash.txt` etc.).
  - `0nogithub/releases-maker.ps1` sıkıştırma scripti güncellenerek pakete girmemesi gereken ekran görüntüleri, önbellek dosyaları ve kilit dosyaları hariç tutuldu.

## [7.9.15] - 2026-07-20

### Bug Fixes & Refactoring / Hata Düzeltmeleri & Düzenlemeler

- **WPF Player Local Playback Direct Access / WPF Oynatıcı Yerel Diskten Oynatma Desteği:**
  - Configured `streamUrl` in `app.js` to map directly to `file:///` local paths instead of backend HTTP stream endpoint when running inside the standalone WPF WebView2 player (`HaYTooL-Player Beta.exe`).
  - Allows downloaded videos to be played directly from the local disk inside the unified Downloads tab player (embedded HTML5 Plyr/Artplayer) with native zero-latency, keeping comment/description sidebars interactive.
  - Eliminated the separate `PlayerWindow` redirect trigger, ensuring all playbacks remain seamlessly inside the tab layout as intended.
  - `app.js` içindeki `streamUrl` ataması güncellenerek, uygulamanın `HaYTooL-Player Beta.exe` (WPF WebView2) içinde çalıştığı tespit edildiğinde ve video indirilmiş durumdaysa, Express.js `/api/video-stream` HTTP akışı yerine doğrudan yerel dosya yolu (`file:///`) kullanılması sağlandı.
  - Bu sayede yerel diskteki videolar, ayrı bir oynatıcı penceresi açılmasına gerek kalmadan, doğrudan İndirilenler sekmesi içindeki gömülü oynatıcı (Plyr/Artplayer) alanında sıfır gecikmeyle oynatılır. Yan paneldeki açıklama ve yorum alanları da kesintisiz olarak görüntülenebilir.
  - Arayüzün bütünlüğünü korumak adına, harici WPF penceresi açan yönlendirme mantığı devredışı bırakılarak tüm oynatım deneyiminin sekme içinde kalması sağlanmıştır.

## [7.9.14] - 2026-07-18

### Features & Enhancements / Özellikler & Geliştirmeler

- **Queue Concurrency Slot Optimization / İndirme Sırası Slot Optimizasyonu:**
  - Kept download slots active during FFmpeg merging phase to prevent starting too many parallel processes, overloading CPU, and causing YouTube rate limits (HTTP 429).
  - İndirme slotlarının FFmpeg birleştirme (merging) işlemi tamamen sonlanana kadar aktif tutulması sağlandı. Bu sayede eşzamanlı limitlerin aşılması, CPU aşırı yüklenmesi ve YouTube engeli (HTTP 429 / Bot doğrulaması) durumları kesin olarak önlendi.

- **Unknown Duration Filtering Check / Belirsiz Süre İndirme Koruması:**
  - Suspended automatic download queueing for newly discovered RSS videos from channels restricting shorts (`downloadShorts: false`) if the duration cannot be fetched immediately.
  - Shorts indirilmesi engellenmiş kanallarda video süresi başlangıçta çözülemezse otomatik indirme kuyruğuna alınması engellendi. Videonun durumu `Süre Analizi` (waiting_duration) olarak güncellenip arka plan servisi süreyi netleştirene kadar bekletilmesi sağlandı.

- **waiting_duration Status Rendering / "Süre Analizi" Durum Gösterimi:**
  - Added support for displaying "Süre Analizi" (Duration Check) status badge and cancelling these videos in the library/history tabs.
  - Arayüze "Süre Analizi" (waiting_duration) durum rozetinin gösterimi entegre edilerek, bu durumdaki videoların iptal edilebilmesi sağlandı.

## [7.9.13] - 2026-07-16

### Bug Fixes & Refactoring / Hata Düzeltmeleri & Düzenlemeler

- **Long Title Wrapping & Dynamic FontSize Fix / Uzun Başlık Taşıma & Dinamik Yazı Boyutu Düzeltmesi:**
  - Added `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` to `.inline-player-title` in `style.css` to guarantee the header row never wraps into two lines.
  - Implemented dynamic font size calculations based on title character length in `app.js` (scaling down from 1.25rem to 0.85rem for longer titles).
  - Attached the full title as a tooltip (`title` attribute) on the element so users can hover to read the complete text.
  - `style.css` içindeki `.inline-player-title` sınıfına `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` kuralları eklenerek uzun başlıkların 2. satıra taşması ve tasarımı bozması kesin olarak engellendi.
  - `app.js` üzerinde başlık karakter uzunluğuna göre dinamik yazı boyutu hesaplaması (1.25rem'den 0.85rem'e kadar otomatik küçülme) eklendi.
  - Başlığa hover (üzerine gelme) yapıldığında tam sürümünü gösteren bir tooltip (`title` özniteliği) entegre edildi.

## [7.9.12] - 2026-07-16

### Bug Fixes & Refactoring / Hata Düzeltmeleri & Düzenlemeler

- **Inline Video Player Details Card Redesign / Gömülü Video Oynatıcı Detay Kartı Yeniden Tasarımı:**
  - Redesigned `.inline-player-info` layout under the player in the Downloads tab for a cleaner, more intuitive structure.
  - Positioned Channel name and logo (`.inline-player-channel`) and Video Title (`.inline-player-title`) side-by-side in a new header row (`.inline-player-header-row`) at the very top.
  - Placed Action buttons (`.inline-player-actions`) directly under the header row.
  - Placed SponsorBlock status messages (`.inline-player-sponsorblock-status`) dynamically below the action buttons.
  - Shifted Metadata stats (`.inline-player-meta-row` containing publish date, download date, file size, and SponsorBlock color legend) to the bottom of the card, separated by a top border partition.
  - İndirilenler sekmesindeki gömülü oynatıcının altındaki `.inline-player-info` bilgi kartı düzeni daha temiz ve sezgisel bir yapıya kavuşturuldu.
  - Kanal logosu ve ismi (`.inline-player-channel`) ile video başlığı (`.inline-player-title`) en üstte yan yana konumlanacak şekilde yeni bir başlık satırı (`.inline-player-header-row`) olarak tasarlandı.
  - Araç ve eylem butonları (`.inline-player-actions`) başlık satırının hemen altına alındı.
  - SponsorBlock bilgi/atlama mesajları (`.inline-player-sponsorblock-status`) aksiyon butonlarının altında dinamik olarak görüntülenecek şekilde konumlandırıldı.
  - Yüklenme tarihi, boyutu ve SponsorBlock renk lejantını barındıran istatistik satırı (`.inline-player-meta-row`) kartın en altına taşındı ve üst çizgisiyle (`border-top`) butonlardan temiz bir biçimde ayrıldı.

## [7.9.11] - 2026-07-15

### Features & Enhancements / Özellikler & Geliştirmeler

- **Player Single Instance Activation & Tray Startup Check / Tekil Oynatıcı Aktivasyonu & Tepsi Başlangıç Denetimi:**
  - Implemented single-instance prevention in `player_launcher.cs` (compiled to `HaYTooL-Player Beta.exe`) using Windows APIs `SetForegroundWindow` and `ShowWindow` to restore and activate the existing WPF Player process window.
  - Implemented cross-process IPC path forwarding using `WM_COPYDATA` messages, allowing newly launched instances to relay target navigation path arguments (e.g. `/settings` or `/downlist`) directly to the active running instance.
  - Added startup check in the player launcher to automatically launch the background tray app `HaYTooL YT Downloader.exe` if not already running.
  - `player_launcher.cs` dosyası güncellenerek `SetForegroundWindow` ve `ShowWindow` Windows API'leri aracılığıyla çalışan mevcut oynatıcıyı öne getirme desteği eklenmiştir.
  - `WM_COPYDATA` mesaj iletim altyapısı kurularak, ikinci kez açılmaya çalışılan sayfa yönlendirme parametrelerinin (örn: `/settings`) arka planda çalışan ana oynatıcı penceresine iletilmesi ve onun üzerinde gösterilmesi sağlanmıştır.
  - Oynatıcı başlatılırken `HaYTooL YT Downloader.exe` arka plan servis uygulamasının açık olup olmadığı denetlenerek, açık değilse otomatik olarak arka planda çalıştırılması sağlanmıştır.

## [7.9.10] - 2026-07-15

### Bug Fixes & Refactoring / Hata Düzeltmeleri & Düzenlemeler

- **WPF Player External Navigation Interception / WPF Oynatıcı Dış Bağlantı Yönlendirmesi:**
  - Registered `NavigationStarting` and `NewWindowRequested` event handlers in CoreWebView2 inside `MainWindow.xaml.cs` to intercept and cancel external domain navigations.
  - Redirected all external URL link clicks (such as GitHub project and developer profile links) to launch directly inside the OS default browser (`Process.Start` with `UseShellExecute = true`), keeping only local backend services inside the WPF container.
  - `MainWindow.xaml.cs` içindeki CoreWebView2 üzerinde `NavigationStarting` ve `NewWindowRequested` olay dinleyicileri kaydedilerek dış etki alanı yönlendirmeleri yakalandı ve iptal edildi.
  - Sürüm bilgisi ve yapımcı profili gibi tüm dış bağlantı tıklamalarının (HTTP/HTTPS) gömülü WPF tarayıcı penceresi yerine işletim sisteminin varsayılan internet tarayıcısında (Chrome, Opera, Edge vb.) harici sekme olarak açılması sağlanmıştır.

## [7.9.9] - 2026-07-15

### Bug Fixes & Refactoring / Hata Düzeltmeleri & Düzenlemeler

- **Tray Double-Click Selection Binding Fix / Tepsi Çift Tıklama Seçim Bağlantı Hatası Düzeltmesi:**
  - Fixed a syntax error in `index.html` where the opening `<select>` tag for `settings-doubleclickaction` was accidentally overwritten.
  - Linked the dropdown input inside `public/app.js` to correctly load its value from the settings JSON database (`db.settings.doubleClickAction`) on page initialization, and save changes automatically via the auto-save form mechanism.
  - `index.html` üzerinde `settings-doubleclickaction` açılış etiketindeki sözdizim hatası düzeltildi.
  - `public/app.js` içerisinde form açıldığında ilgili ayarın veritabanından okunarak (`db.settings.doubleClickAction`) kutuya yüklenmesi ve her değişiklik yapıldığında otomatik olarak veritabanına kaydedilmesi sağlanmıştır.

## [7.9.8] - 2026-07-15

### Features & Enhancements / Özellikler & Geliştirmeler

- **Tray Double-Click Player Action & Launcher Fixes / Tepsi Çift Tıklama Oynatıcı Eylemi ve Başlatıcı Düzeltmeleri:**
  - Added "HaYTooL-Player Beta.exe" option to the "Tray Double-Click Action" settings list, allowing the standalone C# player app to be launched directly on tray double-click.
  - Localized the new option (`opt_doubleclick_player`) across all 7 supported language files (`tr`, `en`, `de`, `es`, `pt`, `ar`, `ru`).
  - Updated `tray.cs` (compiled to `HaYTooL YT Downloader.exe`) to execute the new option by launching the player executable with dynamic arguments.
  - Resolved launcher load crash by modifying `0nogithub/player_launcher.cs` to set the target working directory to the target binary folder (`bin\`) and passing command-line routing arguments (`/settings` or `/downlist`).
  - "Tepsi Çift Tıklama Eylemi" ayarlarına "HaYTooL-Player Beta.exe" seçeneği eklenerek tepsi simgesine çift tıklandığında doğrudan oynatıcı uygulamasının açılması sağlanmıştır.
  - Bu seçenek (`opt_doubleclick_player`) desteklenen 7 dil dosyasına (`tr`, `en`, `de`, `es`, `pt`, `ar`, `ru`) yerelleştirilmiştir.
  - `tray.cs` (derlenen `HaYTooL YT Downloader.exe`) dosyası güncellenerek bu seçenek seçildiğinde oynatıcı başlatıcısının dinamik sayfa argümanlarıyla çalıştırılması sağlanmıştır.
  - `0nogithub/player_launcher.cs` başlatıcı dosyasında çalışma dizini hedef `bin\` dizini olarak set edilerek ve gelen sayfa parametrelerini (/settings vb.) hedefe aktaracak şekilde güncellenerek başlatıcının çalışma zamanında çökmesi engellenmiştir.

## [7.9.7] - 2026-07-15

### Features & Enhancements / Özellikler & Geliştirmeler

- **CSS Layout Spacing Optimization / Arayüz Boşluk Optimizasyonu:**
  - Reduced the top padding of the main content container (`.main-content` in `style.css`) from `40px` to `15px` to eliminate the unnecessary gap between the top tab headers and the main tab contents (filters, embedded video details, and IPTV controls).
  - Üst bar sekme başlıkları ile ana içerik alanları (kütüphane filtreleri, gömülü video oynatıcı ve IPTV kontrolleri) arasındaki gereksiz boşluğu kaldırmak amacıyla `.main-content` alanının üst iç boşluğu (`padding-top`) `40px` değerinden `15px` değerine düşürülmüştür. Böylece arayüz daha kompakt ve bütünleşik hale getirilmiştir.

## [7.9.6] - 2026-07-15

### Bug Fixes & Refactoring / Hata Düzeltmeleri & Düzenlemeler

- **Turkish Encoding & Default Browser Redirections / Türkçe Karakter & Varsayılan Tarayıcı Düzeltmeleri:**
  - Added `--encoding utf-8` parameter to `yt-dlp` description fetch execution in `streams.js` to force correct Turkish character output.
  - Refactored `window.openYouTube` in `public/app.js` to dispatch a POST request to `/api/open-youtube` to open YouTube links using the host OS's default web browser instead of inside the WPF WebView2 container.
  - `streams.js` dosyasındaki `yt-dlp` video açıklaması çekme işlemine `--encoding utf-8` parametresi eklenerek Türkçe karakterlerin (ı, ş, ğ, ç vb.) bozulması engellenmiştir.
  - `public/app.js` içindeki `window.openYouTube` fonksiyonu güncellenerek `/api/open-youtube` API rotasını tetikleyecek şekilde değiştirilmiştir. Bu sayede "YouTube'da Aç" butonuna basıldığında link WebView2 içerisinde değil, bilgisayarın varsayılan varsayılan internet tarayıcısında (Chrome, Edge vb.) harici pencerede açılır.

## [7.9.5] - 2026-07-15

### Features & Enhancements / Özellikler & Geliştirmeler

- **Video Details & Comments Refresh / Video Detaylarını ve Yorumları Güncelleme:**
  - Added an inline button next to the autoplay toggle (`inline-btn-refresh-details`) to trigger scraping/updating the description and comments for the currently playing video.
  - Implemented the `/api/video/:videoId/refresh-details` POST route, utilizing `yt-dlp` to fetch fresh description text from YouTube and write it back onto the `.description` file on disk.
  - Connected the client button to trigger both description updates and dynamically reload YouTube comments, accompanied by sleek loading, success, and error overlay notifications.
  - Gömülü oynatıcının altındaki kontrol alanına yeni bir detayları güncelleme butonu (`inline-btn-refresh-details`) eklenmiştir. Bu buton tıklandığında oynatılan videonun açıklamaları ve yorumları güncellenir.
  - Arka planda `/api/video/:videoId/refresh-details` API rotası oluşturulmuştur. Bu rota, `yt-dlp` üzerinden güncel açıklamayı çekerek disk üzerindeki yerel `.description` dosyasını günceller.
  - Butona tıklandığında hem yerel açıklama dosyası güncellenip ekrana basılmakta hem de YouTube yorumları canlı olarak yeniden sorgulanarak yüklenmektedir. Tüm bu süreç yüklenme, başarı ve hata animasyonlu bildirim kartlarıyla arayüzde gösterilmektedir.

## [7.9.4] - 2026-07-15

### Bug Fixes & Refactoring / Hata Düzeltmeleri & Düzenlemeler

- **Unified Single Window Playback / Birleştirilmiş Tek Pencere Oynatım Mimarisi:**
  - Configured the main dashboard WebView2 environment with `--disable-web-security` in `MainWindow.xaml.cs` to allow loading local file system resources (`file:///` protocol) inside the dashboard.
  - Disabled the launch redirect for the separate `PlayerWindow` inside `public/app.js`, routing all normal video playbacks to the embedded HTML5 (Plyr/Artplayer) player layout.
  - Resolved `streamUrl` assignment in `public/app.js` to map directly to `file:///` local paths instead of the Node.js `/api/video-stream` backend proxy when running inside the wrapper window, resulting in native zero-latency direct disk playback.
  - Ana kontrol paneli WebView2 motoru (`MainWindow.xaml.cs`) `--disable-web-security` parametresi ile başlatılarak yerel dosya sistemindeki dosyalara (`file:///` protokolü) doğrudan erişim izni verilmiştir.
  - Harici `PlayerWindow` oynatıcı penceresinin açılması `public/app.js` içinde devre dışı bırakılmış, tüm normal videoların doğrudan ana penceredeki indirilenler sekmesindeki gömülü oynatıcı (HTML5 Plyr/Artplayer) alanında açılması sağlanmıştır.
  - Oynatıcı video kaynağı (`streamUrl`), yerel dosya varsa doğrudan `file:///` formatına çevrilerek Node.js sunucusundan akış yapılmadan sıfır gecikmeyle doğrudan diskten okunacak şekilde güncellenmiştir. Böylece yorumlar, açıklamalar ve oynatıcı tek bir pencerede kusursuz bir şekilde birleştirilmiştir.

## [7.9.3] - 2026-07-15

### Bug Fixes & Refactoring / Hata Düzeltmeleri & Düzenlemeler

- **Native Dashboard Wrapper / Yerel Kontrol Paneli Arayüzü (HaYTooL YT Downloader.exe):**
  - Enabled HTML5 fullscreen support for IPTV streams and embedded web players inside the primary Dashboard window by handling the `ContainsFullScreenElementChanged` event in `MainWindow.xaml.cs`. Toggling fullscreen on IPTV channels now maximizes the wrapper window to cover the screen seamlessly.
  - Ana Dashboard arayüzü (`MainWindow.xaml.cs`) üzerinde WebView2 için `ContainsFullScreenElementChanged` olayı dinlenerek IPTV kanalları ve diğer tüm gömülü oynatıcılar için tam ekran desteği etkinleştirildi. IPTV kanallarında tam ekrana tıklandığında program penceresi monitörü kaplayacak şekilde tam ekrana geçmektedir.

## [7.9.2] - 2026-07-15

### Bug Fixes & Refactoring / Hata Düzeltmeleri & Düzenlemeler

- **Native Desktop Player Wrapper / Yerel Masaüstü Oynatıcı Uygulaması (HaYTooL-Player Beta.exe):**
  - Resolved media autoplay and resume (playback location) race conditions by moving initialization tasks from Plyr `ready` event to `canplay` event (handling DOM elements check and synchronization on media load).
  - Bypassed Chromium autoplay gesture restrictions in WebView2 by adding the `--autoplay-policy=no-user-gesture-required` command line option.
  - Decoupled `PlayerWindow` taskbar grouping from `MainWindow` on the Windows taskbar by calling COM shell `SHGetPropertyStoreForWindow` and assigning distinct `AppUserModelID` strings (`HaYTooL.MainWindow` and `HaYTooL.PlayerWindow`).
  - Added click-to-seek support for video description timestamps (e.g. `01:00`, `12:34`, `01:23:45`) that parses, linkifies, and jumps to specific chapters natively.
  - Redesigned the sidebar width from `380px` to `320px` and replaced comment list elements with modern, dark rounded cards (bubbles) for a sleeker visual appearance.
  - Video oynatıcının `ready` olayında video süresi bilinmeden konum değiştirme hatası giderildi, otomatik oynatma ve resume (kaldığı yerden devam etme) işlemleri videonun oynatılabilirliğini garanti eden `canplay` olayına bağlanarak stabilize edildi.
  - WebView2 tarayıcı motorunun kullanıcı tıklaması olmadan sesli video oynatma engeli `--autoplay-policy=no-user-gesture-required` parametresiyle kaldırıldı.
  - Oynatıcı penceresinin Windows görev çubuğunda ana yazılım penceresiyle üst üste gruplanması, `SHGetPropertyStoreForWindow` Windows COM arabirimi üzerinden pencerelere farklı `AppUserModelID` (`HaYTooL.MainWindow` ve `HaYTooL.PlayerWindow`) değerleri verilerek engellendi.
  - Video açıklama metnindeki zaman damgaları (01:00, 1:23:45 vb.) tıklanabilir yapıldı ve tıklandığında videonun o saniyeye atlaması sağlandı.
  - Bilgi yan paneli genişliği 380px'den 320px'e düşürülerek video alanı genişletildi, yorumlar listesine modern koyu yuvarlatılmış kart (bubble) görünümü uygulandı.

## [7.9.1] - 2026-07-12

### Bug Fixes & Refactoring / Hata Düzeltmeleri & Düzenlemeler

- **Native Desktop Player Wrapper / Yerel Masaüstü Oynatıcı Uygulaması (HaYTooL-Player Beta.exe):**
  - Designed and compiled a standalone C# WPF application hosting Microsoft Edge WebView2 and an integrated high-performance Plyr player.
  - Implemented automatic local subtitle scanner that reads and packages VTT and SRT files into base64 Data URIs to completely bypass Chromium CORS restrictions on local track tags.
  - Bound full keyboard shortcuts (Space/K, F, C, M, Home, End, <, >, 0-9 digits) and mouse scroll wheel volume adjustments.
  - Set dynamic window title formatted as: `Video Title - Channel Name - Upload Date`.
  - Added playback resume functionality that remembers and resumes video play from the last watched position, fully synced with the main web app localStorage.
  - C# WPF tabanlı, Edge WebView2 gömülü bir masaüstü uygulaması ve yerel video oynatıcı geliştirildi.
  - Yerel altyazı yüklemedeki tarayıcı (CORS) kısıtlamalarını aşmak için videonun bulunduğu klasördeki `.vtt` ve `.srt` altyazı dosyalarını otomatik olarak okuyup dinamik base64 Data URI'ye çeviren sistem kuruldu (Türkçe ve İngilizce altyazılar otomatik çözülür).
  - Oynatıcıya mouse scroll tekerleğiyle ses kontrolü ve klavye kısayollarının tamamı (Space/K, F, C altyazı aç/kapat, M sessize al, Home/End, <, >, 0-9 süre yüzdesi kısayolları) eklendi.
  - Pencere başlığı dinamik olarak `"Video Başlığı - Kanal Adı - Yüklenme Tarihi"` şeklinde güncellendi.
  - Videoları son kapatılan veya duraklatılan saniyeden başlatacak "Kaldığı Yerden Devam Et" (playback resume) hafızası entegre edildi.

- **Paste & Download Database Persistence / Yapıştır & İndir Veritabanı Kalıcılığı:**
  - Removed the restriction in `writeDb` that filtered out manual or standalone downloads during disk persistence. Manual/standalone downloads now persist across database reads and server restarts, showing up correctly in the Downloaded tab.
  - Veritabanını diske yazan `writeDb` metodundaki manuel veya bağımsız indirme kayıtlarını temizleyen kısıtlama kaldırıldı. Artık PD üzerinden indirilen tüm videolar veritabanında kalıcı olarak saklanmakta ve İndirilenler sekmesinde sorunsuzca listelenmektedir.

- **PD Download Title Scraping Fallback / PD İndirmelerinde Başlık Çözümleme Yedek Kontrolü:**
  - Implemented a yt-dlp metadata scraping fallback for Paste & Download links. If HTTP scraping fails due to YouTube consent redirection, the system uses yt-dlp to resolve the actual video title and channel details instantly during download initialization.
  - Yapıştır & İndir sayfasından tetiklenen indirmeler için yt-dlp tabanlı yedek detay çözümleyici eklendi. YouTube HTTP kazıma engelleri/yönlendirmeleri nedeniyle başlık boş kaldığında yt-dlp devreye girerek gerçek video adını ve kanal bilgisini çözüp indirme kuyruğuna aktarır.

- **Double Notification Sound Prevention / Çift Bildirim Sesi Önleme:**
  - Prevented duplicate beep sounds on download completion by disabling the PowerShell console beep when the backend server is running under the C# Tray Launcher. The tray launcher already plays the notification beep natively.
  - İndirme tamamlandığında C# Tray uygulaması ve PowerShell'in aynı anda ses çalmasından kaynaklanan çift bip sesi engellendi. Sunucunun Tray Launcher altında çalışıp çalışmadığı otomatik kontrol edilerek mükerrer PowerShell ses çalma işlemi devre dışı bırakıldı.

- **Upcoming & Live Stream Auto-Download Sync / Yaklaşan & Canlı Yayın Otomatik İndirme Senkronizasyonu:**
  - Added upcoming/live stream completion check to the parallel RSS scanner `checkAllChannelsRssParallel`. Background checks and manual RSS refreshes now correctly detect ended live streams and auto-enqueue them for downloading.
  - Toplu/paralel RSS tarayıcısına (`checkAllChannelsRssParallel`) yaklaşan/canlı yayınların bitiş durumunu denetleme ve indirme kuyruğuna ekleme mantığı entegre edildi. Artık yayın bittiğinde otomatik indirme süreci hemen başlatılmaktadır.


## [7.9.0] - 2026-07-11

### Bug Fixes & Refactoring / Hata Düzeltmeleri & Düzenlemeler


- **yt-dlp Duration Scraper Stability / yt-dlp Süre Çözümleyici Kararlılığı:**
  - Removed `--js-runtimes` parameter from the yt-dlp scraper to avoid crashes caused by whitespace in Node executable path. Also integrated the yt-dlp backup duration logic into the background `resolveMissingDurations` service.
  - yt-dlp süre sorgulama komutundan `--js-runtimes` kaldırıldı; böylece Node.exe dosya yolundaki boşlukların sebep olduğu çökmeler giderildi. Ayrıca yt-dlp yedek süre tespiti arka plandaki `resolveMissingDurations` (eksik süreleri çözme) servisine de entegre edildi.

- **Bulk Delete API Fix & View Modes / Toplu Silme API Düzeltmesi ve Görünüm Modu:**
  - Resolved the empty page issue in the bulk delete tab by replacing the non-existent `/api/data` endpoint with direct reading from `localDb.history`. The list now renders instantly and is updated in real-time when the database changes.
  - Toplu silme sekmesinin boş kalmasına sebep olan sunucuda mevcut olmayan `/api/data` API isteği, doğrudan yerel veritabanı belleğinden (`localDb.history`) anında ve hatasız okuma ile değiştirilerek sorun çözüldü. Ayrıca liste artık veritabanı güncellemelerinde anlık olarak canlı güncellenmektedir.


## [7.8.0] - 2026-07-10

### New Features & Improvements / Yeni Özellikler & Geliştirmeler

- **RSS Shorts Duration Fallback via yt-dlp / RSS Eşitlemesinde Shorts Süresi İçin yt-dlp Yedek Kontrolü:**
  - When a newly discovered video's duration cannot be resolved via the HTTP `fetchVideoDuration` method, the system now falls back to a direct yt-dlp `--print %(duration_string)s` check before adding the video to the queue. This ensures `downloadShorts = false` channel settings are applied correctly even when the HTTP scrape fails.
  - Yeni keşfedilen bir videonun süresi HTTP tabanlı `fetchVideoDuration` ile çözülemezse, video kuyruğa alınmadan önce yt-dlp ile `--print %(duration_string)s` yedek kontrolü yapılır. Bu sayede `downloadShorts = false` ayarlı kanallarda Shorts videoların hatalı kuyruğa alınması engellenir.

- **Bulk Delete Card Grid UI / Toplu Silme Zengin Kart Grid Arayüzü:**
  - The bulk delete list in the Tools tab has been completely redesigned from a plain table into a rich card grid matching the Downloads tab style. Each card shows a thumbnail, duration badge, title, channel name, file size, download date, and an absolute-positioned checkbox. Clicking anywhere on the card body also toggles selection. Full dark/light theme support.
  - Araçlar sekmesindeki Toplu Silme listesi düz tablodan, İndirilenler sekmesiyle eşleşen zengin kart grid sistemine dönüştürüldü. Her kart: kapak resmi, süre rozeti, başlık, kanal adı, dosya boyutu, indirme tarihi ve absolute konumlu checkbox içerir. Kart gövdesine tıklayarak da seçim yapılabilir. Koyu/açık tema tam uyumlu.

## [7.7.0] - 2026-07-10

### New Features & Improvements / Yeni Özellikler & Geliştirmeler
- **Discord Rich Presence Pause Overhaul / Discord RPC Duraklatma İyileştirmesi:**
  - Kept the Discord RPC "Watching" presence active during video pauses instead of clearing it immediately. The presence is now only cleared when the player is fully closed or the video reaches the end.
  - Video duraklatıldığında Discord'daki "izliyor" durumu kaybolmayacak şekilde güncellendi. Duraklatma durumunda da video bilgileri aktif kalır, yalnızca oynatıcı kapatıldığında veya video bittiğinde durum temizlenir.
- **Library Duration Filter / Kütüphane Süre Filtresi:**
  - Added a dropdown selector (1-30 mins) to the library tab to filter out videos shorter than the selected threshold. This filter value is saved in the database settings (`historyDurationFilter`) and persistent across reboots.
  - Kütüphane sekmesine 1-30 dakika arasında süre filtresi (açılır menü) eklendi. Seçilen sürenin altında kalan videolar listeden gizlenir. Bu ayar veri tabanına (`historyDurationFilter`) kaydedilir ve uygulama açılışında kalıcı olarak yüklenir.
- **Bulk Video Deletion / Toplu Video Silme:**
  - Added a "Bulk Delete" card in the Tools tab. Users can select multiple downloaded videos via checkboxes and delete them from both the database and the physical disk.
  - Araçlar sekmesine "Toplu Video Silme" alanı eklendi. Kullanıcılar indirilen videoları checkbox ile çoklu seçerek tek tıkla veritabanından ve diskten topluca silebilirler.
- **Filter Reset Icon Enhancements / Süzgeç İkon İyileştirmeleri:**
  - Standardized `.filter-icon` element with cursor pointer, hover scaling, and primary color transitions for better click visibility.
  - Kütüphane ve İndirilenler sekmelerindeki filtre sıfırlama ikonunun (`.filter-icon`) tıklanabilir olduğu hover efektleri, imleç ve opaklık düzenlemeleriyle belirginleştirildi.

## [7.6.3] - 2026-07-09


### Performance Optimizations / Performans Optimizasyonları
- **Skip Duration Lookup for Ignored Videos / Göz Ardı Edilen Videoların Süre Çözümlemesi Atlattırıldı:**
  - Optimized the background `resolveMissingDurations` service to completely skip duration and metadata resolution for videos with an `ignored` status. This prevents massive console log spam and unnecessary network requests to YouTube watch pages when bulk scanning.
  - Arka planda çalışan `resolveMissingDurations` servisi, durumu `ignored` (göz ardı edilmiş) olan videoların sürelerini veya diğer bilgilerini çözmeye çalışmayacak şekilde optimize edildi. Böylece toplu kanal kontrollerinde konsolun spam loglarla dolması ve gereksiz ağ trafiği tamamen engellendi.

## [7.6.2] - 2026-07-09

### Improvements / Geliştirmeler
- **Dynamic History-Referenced RSS Filtering / Geçmiş Referanslı Dinamik RSS Filtreleme:**
  - Replaced the hardcoded 48-hour threshold with a dynamic history-referenced filter. If a channel has history items, the system compares incoming video dates with the latest published video in history (`latestHistoryTime`). Videos older than `latestHistoryTime` are ignored, while newer ones are downloaded, allowing the system to correctly handle offline periods of any duration (e.g. PC closed for 4 days) without downloading old backlogs.
  - Sabit 48 saatlik sınır yerine geçmiş referanslı dinamik filtre yapısına geçildi. Eğer kanala ait geçmiş kaydı varsa, yeni videolar geçmişteki en son videonun yayınlanma tarihiyle kıyaslanır. Bu tarihten yeni olan videolar (örn. bilgisayarın 4 gün kapalı kalması senaryosu) başarıyla yakalanıp indirilirken, eski videolar göz ardı edilir.

## [7.6.1] - 2026-07-09

### Bug Fixes / Hata Düzeltmeleri
- **Prevent Downloading Old Videos in Parallel Sync / Eski Videoların Kuyruğa Alınması Engellendi:**
  - Added a 48-hour age threshold for newly discovered videos during RSS scanning. Videos older than 48 hours will be marked as `ignored` rather than `waiting`, preventing accidental mass downloads of historical videos.
  - RSS taramalarında keşfedilen yeni videolar için 48 saatlik (2 günlük) bir yayın tarihi sınırı eklendi. 48 saatten eski videolar `waiting` yerine `ignored` olarak işaretlenerek geçmişteki eski videoların kazara topluca indirilmesi engellendi.

## [7.6.0] - 2026-07-09

### Performance Improvements / Performans İyileştirmeleri
- **Parallel RSS Scanning for Manual Sync / Manuel Eşitlemede Paralel RSS Taraması:**
  - Implemented concurrent RSS fetching using `Promise.allSettled` when checking channels via the "Check channels now" button, reducing manual check times from up to a minute down to 1-2 seconds.
  - "Şimdi Kanalları Denetle" butonu tetiklendiğinde tüm kanalların RSS akışlarının eşzamanlı (`Promise.allSettled`) olarak taranması sağlandı; böylece manuel kontrol süresi 1-2 saniyeye düşürüldü.
  - Centralized database locking to prevent deadlocks and race conditions during mass updates.
  - Toplu güncellemeler sırasında kilit çakışmalarını (deadlock) önlemek için veritabanı kilit yönetimi tek çatı altında optimize edildi.

## [7.5.9] - 2026-07-09

### Code Quality & i18n Fixes / Kod Kalitesi & Dil Düzeltmeleri
- **Turkish JSDocs / Türkçe JSDoc Yorumları:**
  - Added comprehensive JSDoc blocks and comments in Turkish across all API route files for developer guidance.
  - Geliştirici rehberliği için tüm API yönlendirici dosyalarına Türkçe JSDoc açıklamaları ve tipler eklendi.
- **i18n & Status Badges Localization / Dil Dosyaları & Üst Bar Durum Çevirileri:**
  - Fixed issue where "Tray Double Click Action" settings labels, "Cookies: Disabled", and "Quality: Best Quality" text remained in Turkish on non-Turkish languages (like German/Spanish).
  - "Tepsi Çift Tıklama Eylemi", "Cookies: Devre Dışı" ve "Kalite: En Yüksek" durum etiketlerinin Almanca/İspanyolca gibi dillerde Türkçe kalması hatası düzeltildi; dile duyarlı dinamik i18n çevirisi sağlandı.
  - Synchronized and filled missing keys in ES, DE, PT, AR, and RU language files.
  - İspanyolca, Almanca, Portekizce, Arapça ve Rusça dil dosyalarındaki eksik çeviri anahtarları eşitlendi.
- **Dynamic ASCII Banner / Dinamik ASCII Sürüm Bilgisi:**
  - Dynamic app version dynamically integrated into the startup terminal ASCII banner.
  - Başlangıç terminalinde basılan ASCII logodaki statik sürüm numarası `server/version.js`'den okunacak şekilde dinamikleştirildi.

## [7.5.8] - 2026-07-09

### New Features & Improvements / Yeni Özellikler & Geliştirmeler
- **Video Card Status Dot Overhaul / Video Kartı Durum Noktaları Yenilendi:**
  - `failed` (hata) durumunda artık "Hata" yazısı gösterilmiyor; sadece **kırmızı nokta** var. Hata mesajı noktanın üzerine gelindiğinde tooltip olarak görünüyor.
  - `ignored` (göz ardı edildi) durumu artık **mavi nokta** ile gösteriliyor (önceden yanlışlıkla kırmızıydı).
  - `completed missing` (dosya eksik) durumu **sarı uyarı noktası** ile gösteriliyor.
  - `completed` (indirildi) durumu **yeşil nokta** ile korunuyor.
- **Video Card Action Buttons Redesign / Aksiyon Butonları Yeniden Tasarlandı:**
  - Her buton tipi için semantik CSS sınıfları (`btn-action-yt`, `btn-action-play`, `btn-action-folder`, `btn-action-cancel`, `btn-action-retry`, `btn-action-download`) tanımlandı.
  - Inline style karmaşası kaldırıldı; butonlar artık renk kodlu, kenarlıklı ve hover animasyonlu hale getirildi.
  - YouTube butonu kırmızı, oynat butonu cyan, klasör butonu sarı, iptal butonu kırmızı, retry butonu sarı, indir butonu yeşil renk temasına sahip.
  - `tv` ikonları daha anlamlı `monitor-play` ikonlarıyla değiştirildi.
  - Hem koyu hem açık tema için tam renk uyumluluğu sağlandı.

## [7.5.7] - 2026-07-08

### New Features & Improvements / Yeni Özellikler & Geliştirmeler
- **Removed Download Start Sound / İndirme Başlama Sesi Kaldırıldı:**
  - Disabled the notification sound on download start (`start` event) as requested to avoid unnecessary noise.
  - İstek üzerine indirme başladığı anda çalan başlangıç bildirim sesi tamamen kaldırıldı.
- **Shortened Success and Error Sound Beeps / İndirme Bildirim Sesleri Kısaltıldı:**
  - Shortened the success sound to a single short, high-pitched native beep (C6, 1046Hz, 120ms) and the error sound to a single warning beep (E4, 330Hz, 200ms) to make them extremely quick, clean, and non-repetitive.
  - İndirme tamamlandığında çalan başarı sesi tek bir temiz ve kısa bibe (C6 - 1046Hz, 120ms) ve indirme hatası sesi tek bir uyarı tonuna (E4 - 330Hz, 200ms) indirgendi. Sesler son derece kısa, net ve sade hale getirildi.

## [7.5.6] - 2026-07-08

### New Features & Improvements / Yeni Özellikler & Geliştirmeler
- **Automatic Port Conflict Resolver in Launcher / Başlangıçta Otomatik Port Çakışması Çözücü:**
  - Integrated a Dialog prompt when the target port (default 4141) is already in use. It notifies the user via screen dialog and asks whether they want to automatically terminate the process using the port and restart the application.
  - Port 4141 doluluğunda kullanıcıya ekran üstü uyarı penceresi (MessageBox) gösterilmesi sağlandı. Kullanıcının onay vermesi durumunda portu işgal eden süreç otomatik sonlandırılarak uygulama temiz bir şekilde yeniden başlatılır.
- **Native Tray Sound Chimes / Arayüz Üzerinden Gecikmesiz Native Ses Çalımı:**
  - Routed sound playing commands from Node.js backend to the C# Tray Launcher using stdout piping (`[TRAY_CMD] play_sound=`). The Tray Launcher plays custom beep melodies natively inside the user's interactive session, resolving silent background sessions and eliminating PowerShell startup delays.
  - Bildirim seslerinin yavaş powershell komutu yerine C# Tray Launcher üzerinden gecikmesiz ve native olarak çalınması sağlandı. `[TRAY_CMD] play_sound=` boru hattıyla sunucudan gelen komutlar tray tarafından arka plan thread'inde anında çalınır.

## [7.5.5] - 2026-07-08

### New Features & Improvements / Yeni Özellikler & Geliştirmeler
- **Custom Melodious Notification Chimes / Uygulamaya Özel Melodik Bildirim Sesleri:**
  - Replaced standard Windows notification sounds with custom melodious beep chords (chimes) using PowerShell `[System.Console]::Beep`.
  - Windows'un varsayılan sistem sesleri (Asterisk, Question, Hand) yerine uygulamanın kendine özel, melodik ve ayırt edilebilir özel bip melodileri entegre edildi.
  - Added distinct tones for download start (quick ascending), download success (cheerful arpeggio), and download error (warning low double-chime).
  - İndirme başlangıcı (hızlı yükselen çift bip), indirme başarısı (neşe verici arpej melodisi) ve indirme hatası (kalın tonda uyarı tonu) için farklı melodiler oluşturuldu.

## [7.5.4] - 2026-07-07

### Bug Fixes / Hata Düzeltmeleri
- **Dynamic Localization in Metadata and Video Titles / Video Başlıklarında ve Metadata Çekiminde Dil Uyumsuzluğu Düzeltmesi:**
  - Resolved an issue where video titles in the library tab were fetched in English despite the application being set to Turkish. Passed the `--extractor-args "youtube:lang=LANG"` option to `yt-dlp` to ensure metadata matches the user's selected language.
  - Uygulama dili Türkçe olmasına rağmen kütüphane sekmesinde video başlıklarının İngilizce gösterilmesi sorunu düzeltildi. `yt-dlp` komutlarına `--extractor-args "youtube:lang=LANG"` argümanı eklenerek YouTube'dan başlık ve diğer bilgilerin seçili dilde çekilmesi sağlandı.
  - Dynamically configured `Accept-Language` headers and `hl` URL parameters across all 7 supported languages during manual RSS check, video duration parsing, and YouTube searches.
  - Manuel RSS denetimi, video süresi çözme ve YouTube aramaları sırasında `Accept-Language` başlıkları ve `hl` URL parametreleri desteklenen 7 dile göre dinamik hale getirildi.
  - Automatically update the titles of already-processed library videos to the localized language during RSS feed sync if they differ from the stored titles.
  - RSS akışı eşitlemesi sırasında, veritabanında daha önceden İngilizce kaydedilmiş olan başlıkların yeni çekilen yerelleştirilmiş dildeki başlıkla otomatik olarak güncellenmesi sağlandı.

## [7.5.3] - 2026-07-07

### Bug Fixes / Hata Düzeltmeleri
- **Truncated Error Tooltip in Video Cards / Hata Durumunda Uzayan Tooltip Düzeltmesi:**
  - Shortened the download error log output shown in the failed status pill tooltip. It now filters and displays only the last relevant `ERROR:` output or a truncated summary instead of spawning massive multiple-line logs that block the browser view.
  - İndirme hatası alan videoların ("Hata" durumundaki) üzerine gelindiğinde tarayıcıda beliren devasa, yüzlerce satırlık hata logu tooltip'i kısaltıldı. Artık sadece en son ve anlamlı `ERROR:` satırı veya ilk 150 karakterlik bir özet gösterilerek ekran kaplama sorunu çözüldü.

## [7.5.2] - 2026-07-07

### Bug Fixes / Hata Düzeltmeleri
- **Library Channel Limit Order Fix / Kütüphane Kanal Başına Geçmiş Limiti Sıralama Düzeltmesi:**
  - Fixed an issue where deleting/hiding a video caused older videos to snoop into the channel list to fill the count. Now, the `hideOnDelete` filter is applied *after* the channel limits are processed, ensuring the channel shows fewer videos instead of backfilling with older history.
  - Bir video silindiğinde veya gizlendiğinde, kanal başına belirlenmiş olan maksimum video sayısı limitinin altına düşüldüğü için daha eski videoların listeye sızması sorunu giderildi. Artık gizleme filtresi kanal bazlı limit uygulandıktan sonra çalıştırılır; böylece eski videolar listeye sızmaz.

## [7.5.1] - 2026-07-07

### New Features & Improvements / Yeni Özellikler & İyileştirmeler
- **Hide Video from Library on Delete / Silinen Videoları Kütüphaneden Gizleme Desteği:**
  - Added a configuration setting `hideOnDelete` to toggle whether deleting a video automatically hides it from the Library tab.
  - Bir video geçmişten veya bilgisayardan silindiğinde Kütüphane sekmesinde de otomatik olarak gizlenmesini sağlayan `hideOnDelete` ayarı ve kontrol kutusu entegre edildi.
  - Handled translation mappings across 7 supported languages (`tr`, `en`, `es`, `de`, `pt`, `ar`, `ru`) and updated deletion responses with custom status logs accordingly.
  - 7 farklı dil dosyası güncellendi ve silme/gizleme bildirimleri dinamikleştirildi.

## [7.5.0] - 2026-07-06

### New Features & Improvements / Yeni Özellikler & İyileştirmeler
- **Dynamic Concurrent Downloads / Dinamik Eşzamanlı İndirme Limiti:**
  - Added a dropdown selector to the Queue tab, allowing users to dynamically set the concurrent download limit (1 to 5).
  - Kuyruk sekmesine kullanıcıların eşzamanlı indirme limitini (1 ila 5) dinamik olarak değiştirebilmesini sağlayan bir seçim kutusu eklendi.
- **Downloading Reordering & Drag-Drop / İndirilenlerin Kuyrukta Sıralanabilmesi:**
  - Integrated downloading items directly into the draggable queue. Moving an active download out of the concurrency limit will stop (kill) the process, put it back to 'waiting', and start the next item automatically.
  - İndirilmekte olan videolar kuyruk listesine entegre edilerek sürüklenebilir yapıldı. Aktif bir indirme limit dışına sürüklendiğinde işlem durdurulup 'bekliyor' durumuna alınır ve sıradaki video otomatik olarak başlatılır.
- **Pre-download Duration & Size Info / İndirme Öncesi Süre ve Boyut Bilgisi:**
  - Added asynchronous metadata scraping (`--simulate`) after adding a video to the queue. Displays approx. file size and duration on the queue card before starting the download.
  - Videolar kuyruğa eklendiğinde arka planda asenkron yt-dlp sorgusu çalıştırılarak video süresi ve tahmini dosya boyutu bilgileri çekilir ve kuyruk kartında gösterilir.
- **Delete Button on Completed Downloads / Tamamlanan İndirmelere Silme Desteği:**
  - Added a trash/delete button next to the play button in the completed downloads history. Clicking it opens the standard deletion confirmation modal to clean up DB records and local files.
  - Kuyruk altındaki tamamlanan son indirilenler listesine sil butonu eklendi. Butona tıklandığında silme onay penceresi açılarak hem veritabanı kaydının hem de yerel dosyanın silinmesi sağlanır.

## [7.4.1] - 2026-07-04

### Bug Fixes / Hata Düzeltmeleri
- **Atomic Database Writes / Atomik Veritabanı Yazımı:**
  - Implemented secure atomic file writing for `db.json` using temporary files (`db.json.tmp`) and atomic rename methods (`fs.renameSync`). This prevents data corruption and settings resets (factory resets) in case of sudden power outages.
  - Implemented secure atomic file writing for `db.json` using temporary files (`db.json.tmp`) and atomic rename methods (`fs.renameSync`). This prevents data corruption and settings resets (factory resets) in case of sudden power outages.
  - Ani elektrik kesintilerinde `db.json` dosyasının bozulmasını ve ayarların sıfırlanmasını önlemek amacıyla geçici dosya kullanılarak atomik dosya yazma yapısı (`fs.renameSync`) entegre edildi.
- **FFmpeg & yt-dlp Queue Timeout / FFmpeg ve yt-dlp Zaman Aşımı Koruması:**
  - Added a global 30-minute timeout for spawn processes to kill hung FFmpeg merge conversions or yt-dlp downloads, preventing infinite queue blockages.
  - Saatlerce süren veya takılıp kuyruğu kilitleyen FFmpeg birleştirme (merge) ve yt-dlp indirme işlemlerine 30 dakikalık zaman aşımı koruması getirildi.
- **Manual Backups Directory Update / Manuel Yedek Klasörü Değişikliği:**
  - Updated the manual system backups directory from `0nogithub/backups/manual/` to the application's root `backup/` directory.
  - Manuel sistem yedeklerinin `0nogithub` yerine doğrudan uygulamanın ana dizinindeki `backup/` klasörüne alınması sağlandı.

## [7.4.0] - 2026-07-04

### New Features & Improvements / Yeni Özellikler & İyileştirmeler
- **Terminal Log Colorization / Renkli Konsol Logları:**
  - Forced ANSI color output on Windows terminals by setting `FORCE_COLOR` and `TERM` environment variables inside the Node.js entry script.
  - Node.js başlatıcı dosyasına `FORCE_COLOR` ve `TERM` değişkenleri eklenerek Windows terminal ekranındaki logların renkli akması sağlandı.
- **Folder Sync Security Fix / Dosya Karşılaştırma Güvenlik Düzeltmesi:**
  - Fixed 403 authorization error on folder comparison paths under Windows due to case sensitivity by comparing paths in lowercase mode.
  - Windows üzerindeki harf duyarlılığından kaynaklanan ve dosya karşılaştırmada 403 hatasına sebep olan yol doğrulama açığı, yollar küçük harfe çevrilerek çözüldü.
- **Compare Button Double-Trigger / Mükerrer Buton Tetikleme Engeli:**
  - Removed duplicate click triggers from the file comparison button to prevent concurrent server-side scanning requests.
  - Dosya karşılaştırma butonundaki mükerrer onclick tetikleyicisi kaldırılarak aynı anda birden fazla tarama yapılması engellendi.
- **Redownload Missing Videos / Eksik Dosyaları Tekrar İndirme Seçeneği:**
  - Added a "Redownload" button directly next to missing files, allowing users to queue them back with a single click.
  - Veritabanında kayıtlı olup diskten silinen (eksik) videolar için tek tıkla tekrar indirme sırasına eklemeyi sağlayan "Tekrar İndir" seçeneği eklendi.
- **Manual Database & Settings Backup / Manuel Sistem Yedekleme:**
  - Implemented a secure backup utility inside Settings tab that bundles `db.json`, `channels.ini`, and settings INI file into a single date-stamped JSON backup file.
  - Ayarlar sekmesine `db.json`, `channels.ini` ve ayar dosyalarınızı tek tıkla yedekleyip geri yüklemenizi sağlayan manuel sistem yedekleme arayüzü ve API desteği eklendi.

## [7.2.0] - 2026-06-29

### New Features & Improvements / Yeni Özellikler & İyileştirmeler
- **Channels Card Grid Redesign & Alphabetical Sorting / Kanallar Kart Tasarımı & Alfabetik Sıralama:**
  - Channels tab completely redesigned with modern card-based grid layout (9 cards per row).
  - Each card shows channel avatar, name, handle, and all channel-specific settings.
  - Added A-Z alphabetic sidebar navigation for quick scrolling.
  - Channels containing numbers and special characters sorted under "#" are now pushed to the bottom of the list instead of top.
  - Cleared redundant URL prefixes (e.g. `https://www.youtube.com/@`) from channel handles, showing only the username.
  - Kanallar sekmesi tamamen modern grid kart tasarımıyla (satır başına 9 kart) yenilendi. Sayı ve özel karakterle başlayan ve "#" altında toplanan kanallar alfabetik sıralamada en üste gelmek yerine listenin en sonuna taşındı. Kanal kullanıcı adlarındaki Youtube URL önekleri temizlendi.

- **Tools Dropdown Menu / Araçlar Açılır Menüsü:**
  - Replaced the old "Hdown" dropdown menu with the new "Tools" (Araçlar) dropdown menu.
  - Removed the standalone folder sync compare button from top bar, placing the "File Comparison & Sync" option directly inside the new Tools dropdown menu.
  - Clicking "File Comparison" instantly switches active view to Advanced Tools tab and automatically triggers the folder scanner.
  - Eski "Hdown" menüsü "Araçlar" (Tools) olarak yeniden adlandırıldı. Sağ üstteki bağımsız dosya karşılaştırma butonu kaldırılarak bu menü altına "Dosya Karşılaştırma" seçeneği olarak eklendi. Tıklandığında hem sekmeyi açar hem de karşılaştırma işlemini anında başlatır.

- **Downloader Playlist Selection & Cover Arts / Playlist Seçimli İndirme & Kapak Resimleri:**
  - The "Downloader" page completely styled to offer a premium, modern user interface.
  - Playlist video resolution now fetches and displays video thumbnails, duration, and interactive checkboxes for each video item.
  - Added a "Select/Deselect All" checkbox in the playlist header. The download button now acts as "Download Selected" by pushing only checked videos into the download queue.
  - Downloader sayfası, mor/eflatun premium detaylarla tamamen görsel olarak yenilendi. Playlist çözümlemede videoların kapak resimleri (thumbnail), süreleri ve yanlarında seçim kutuları (checkbox) eklendi. Listede sadece seçilen videoların indirilmesini sağlayan seçimli indirme kuyruğu mantığı uygulandı.

- **YouTube Music & MP3 Embedded Thumbnails / YouTube Music & MP3 Kapak Resmi Desteği:**
  - Integrated YouTube Music playlist and video URL parsing using native downloader regex extensions.
  - When downloading audio as MP3, yt-dlp now embeds the video's cover image directly into the generated MP3 file (`--embed-thumbnail`).
  - YouTube Music URL regex tanımları genişletildi. MP3 olarak indirilen tüm müzik ve ses dosyalarında videonun orijinal kapak resminin MP3 dosyasına gömülmesi (`--embed-thumbnail`) sağlandı.

## [7.1.0] - 2026-06-27

### New Features & Improvements / Yeni Özellikler & İyileştirmeler
- **Foreground Explorer Focus / Windows Gezgini Ön Plana Getirme:**
  - Implemented PowerShell COM `wscript.shell AppActivate` wrapper to bring the opened Explorer windows directly to the foreground when clicking "Open Location" (Konumu Aç) or "Open Folder" (Klasörü Aç) on Windows, resolving background window issue.
  - Windows üzerinde "Konumu Aç" veya "Klasörü Aç" butonlarına tıklandığında, açılan Windows Gezgini pencerelerinin arka planda kalmasını önleyen ve doğrudan ön plana (aktif pencereye) getiren PowerShell COM `wscript.shell AppActivate` mekanizması entegre edildi.

- **Orphan File Companion Cleaning Fix / Yetim ve Alakasız Dosya Silme:**
  - Standardized orphan video companion file (.part, .ytdl, .jpg) cleanups to automatically trace and purge all supplementary files during a single untracked file deletion.
  - Yetim videolar silindiğinde, video dosyası ile ilişkili tüm yan/companion dosyaların (.part, .ytdl, kapak resimleri, altyazılar vb.) tek tıkla temizlenmesi asenkron olarak tamamlandı.

- **CLI & Console Commands Documentation / CLI & Konsol Hız Komutları Örneği:**
  - Added CLI usage example `"HaYTooL YT Downloader.exe" pd youtubelinki` to the translation tables under Settings page and updated `README.md` across all 7 supported languages.
  - Ayarlar sekmesindeki terminal/konsol yönergelerine ve `README.md` içerisine doğrudan CLI üzerinden video indirmeyi tetikleyen `"HaYTooL YT Downloader.exe" pd youtubelinki` komut satırı örneği tüm 7 dilde eklendi.

### Bug Fixes / Hata Düzeltmeleri
- **ES Module Require Error Fix / ES Modül Require Hatası Giderimi:**
  - Fixed the `require is not defined` reference error encountered when opening file locations by using the globally imported ES module `exec` method.
  - Dosya konumunu açarken oluşan `require is not defined` hatası, globalde önceden içe aktarılmış olan ES modül `exec` işlevi kullanılarak tamamen giderildi.

- **Dynamic Table Heights in Tools Page / Araçlar Sayfası Tablo Yükseklikleri:**
  - Removed the fixed `max-height: 450px` scroll limits on the Advanced File Comparison file list tables, allowing list elements to expand vertically according to their content size for easier readability.
  - Gelişmiş Dosya Karşılaştırma listelerindeki 450px maksimum dikey yükseklik kısıtlaması kaldırılarak, listelerin dikeyde sığacak şekilde otomatik olarak genişlemesi sağlandı.

- **Library History Channel Limit Ordering / Kütüphane Kanal Sınırı Mantığı:**
  - Updated the library video filtering system to apply the channel history limit *before* hiding hidden videos. This prevents older archived videos from automatically populating the grid slots when a newer video is hidden.
  - Kütüphane listeleme mantığında kanal limitleri (Örn: 5) uygulanırken, gizli videolar da limit havuzuna dahil edildi. Böylece bir video gizlendiğinde arkadan eski bir videonun listeye girmesi engellenerek gösterim sayısının 4'e düşmesi sağlandı.

## [7.0.0] - 2026-06-27


### New Features & Improvements / Yeni Özellikler & İyileştirmeler
- **Download Folder Comparison & DB Reconciliation / İndirme Klasörü Karşılaştırma & Senkronizasyon:**
  - Implemented the "Advanced Tools" (Gelişmiş Araçlar) tab to scan and compare physical files on disk with the database history.
  - Detects "Orphan Files" (yetim dosyalar - files on disk but missing in DB) and "Missing Files" (eksik dosyalar - records in DB but deleted on disk).
  - Added quick action commands: "Import to Database" (Veritabanına Ekle), "Delete from Disk" (Diskten Sil), "Mark as Not Downloaded" (İndirilmedi İşaretle), and "Delete from History" (Geçmişten Sil).
  - Supports bulk actions: "Import/Delete All Orphans" and "Reset/Delete All Missing" records.
  
  - Disk üzerindeki dosyaları veritabanı kayıtları ile fiziksel olarak karşılaştıran "Gelişmiş Araçlar" sekmesi geliştirildi.
  - "Yetim Dosyaları" (disk üzerinde var olan ancak veritabanında kaydı bulunmayanlar) ve "Eksik Dosyaları" (veritabanında kayıtlı fakat diskte silinmiş olanlar) tespit eder.
  - "Veritabanına Ekle", "Diskten Sil", "İndirilmedi İşaretle" ve "Geçmişten Sil" hızlı eylem komutları eklendi.
  - Toplu düzeltme düğmeleri ile tek tıkla yetim dosyaları içe aktarma/silme ve eksik kayıtları güncelleme desteği sunuldu.

- **System Tray Double-Click Preference / Sistem Tepsisi Çift Tıklama Tercihi:**
  - Added a configuration setting (`doubleClickAction`) to general settings allowing users to choose whether double-clicking the system tray icon opens the UI in their default system browser or in the application's Edge App Mode browser.
  - Updated the C# System Tray launcher (`tray.cs`) to dynamically read `configwin.ini` and launch the selected browser mode.
  - Recompiled the Windows Launcher executable (`HaYTooL YT Downloader.exe`) with the updated behavior and embedded application icon.
  
  - Sistem tepsisindeki (tray) simgeye çift tıklandığında uygulamanın varsayılan sistem tarayıcısında mı yoksa Edge App modunda mı açılacağını seçmeyi sağlayan `doubleClickAction` ayarı eklendi.
  - C# başlatıcısı (`tray.cs`), `configwin.ini` dosyasından bu tercihi okuyup ilgili tarayıcı modunu başlatacak şekilde güncellendi.
  - C# başlatıcı programı (`HaYTooL YT Downloader.exe`), gömülü simge desteğiyle yeniden derlendi.

- **Live Stream Tracking in Library / Kütüphanede Canlı Yayın Takibi:**
  - Detects active live streams from followed channels and renders them in the Library tab with a custom blinking red "LIVE" / "CANLI" status pill.
  - Clicking an active live stream card opens the stream in the embedded player (falling back to YouTube iframe embed streaming).
  - Added a toggle filter (`history-show-live`) at the top of the Library tab to dynamically show or hide active live streams in the grid.
  
  - Takip edilen kanallardaki aktif canlı yayınları otomatik tespit eder ve Kütüphane sekmesinde yanıp sönen kırmızı bir "LIVE" / "CANLI" durum rozetiyle görüntüler.
  - Canlı yayın kartına tıklandığında, video gömülü oynatıcı üzerinden (YouTube iframe akışı ile) anında oynatılabilir/izlenebilir.
  - Kütüphane araç çubuğuna, canlı yayınları grid listesinde gösterip gizlemeyi sağlayan bir filtreleme seçeneği (`history-show-live`) eklendi.

- **Clickable Channel Names / Tıklanabilir Kanal İsimleri:**
  - Channel names displayed on video cards in both Library and Downloaded tabs are now clickable, instantly applying a filter to show only that channel's videos.
  
  - Kütüphane ve İndirilenler sekmelerindeki video kartlarında yer alan kanal isimleri tıklanabilir hale getirildi; tıklandığında ilgili kanalın videolarını otomatik olarak filtreler.

- **Granular Shorts Duration Limit Expansion / Gelişmiş Shorts Süre Sınırı Seçenekleri:**
  - Expanded the shorts duration limit options under the Channels tab configuration to include options up to 1.5 hours (20m, 30m, 45m, 1h, 1.5h) for much more granular control.
  
  - Kanal ayarlarındaki Shorts indirme süre sınırı seçenekleri genişletilerek 1.5 saate kadar olan süre limitleri (20dk, 30dk, 45dk, 1sa, 1.5sa) eklendi.

- **SSE Channel Scan Progress Toast / SSE Kanal Denetim İlerleme Bildirimi:**
  - Implemented real-time progress update to manual channel scan triggers, showing a single persistent toast notification indicating current scan progress (e.g. "5/30 - Checking AkademikLink").
  
  - Sağ üstten tetiklenen manuel kanal denetimi işlemine gerçek zamanlı ilerleme takibi eklendi. Denetleme durumunu gösteren tek ve kalıcı bir bildirim toast kutusu ile ilerleme anlık yansıtılır (Örn: "5/30 - AkademikLink denetleniyor").

## [6.0.0] - 2026-06-23

### New Features & Improvements / Yeni Özellikler & İyileştirmeler
- **Discord Rich Presence Integration / Discord Durumu Entegrasyonu:**
  - Added Windows Named Pipe IPC support (`\\\\.\\pipe\\discord-ipc-0`) to send status updates directly to active Discord clients.
  - Implemented automated status reporting when standard videos are played, paused, or finished.
  - Added a global setting (`discordRpcEnabled`) synced across database (`db.json`) and OS configuration files (`configwin.ini` / `configunix.ini`).
  - Added "Discord Durumu" (Discord Status) toggles into both the settings menu and the C# System Tray context menu.
  - Translates the Discord status toggle controls across all 7 supported UI languages.
  - Recompiled the Windows Launcher binary (`HaYTooL YT Downloader.exe`) to support the new tray checkbox and settings endpoints.
  
  - Discord istemcisiyle doğrudan Named Pipe IPC kanalı (`\\\\.\\pipe\\discord-ipc-0`) üzerinden konuşan hafif bir Discord RPC istemcisi entegre edildi.
  - Gömülü oynatıcıda videolar oynatıldığında, duraklatıldığında veya bittiğinde Discord etkinlik durumunun anlık güncellenmesi sağlandı.
  - Arayüz Ayarlar paneline ve C# Sistem Tepsisi (Tray) sağ tık menüsüne "Discord Durumu" açma/kapatma seçeneği eklendi.
  - Tüm ayarlar veritabanı (`db.json`) ve INI dosyaları (`configwin.ini` / `configunix.ini`) ile anlık senkronize çalışacak şekilde yapılandırıldı.
  - Yeni eklenen ayar bileşenleri 7 farklı arayüz diline göre yerelleştirildi.
  - Windows C# Başlatıcı exe dosyası (`HaYTooL YT Downloader.exe`) yeni menü öğesini ve API isteklerini destekleyecek şekilde derlenerek güncellendi.

## [5.3.8] - 2026-06-22

### Fixed / Düzeltmeler
- **Windows Notification Icon & Lifecycle / Masaüstü Bildirim Simgesi & Süreci:**
  - Resolved physical path resolution issue for `icon.ico` when the backend compiled binary is running by replacing `__dirname` with `process.cwd()`.
  - Added a 4-second delay (`Start-Sleep -s 4`) and clean `Dispose()` command to the PowerShell notification runner to ensure the balloon tooltip displays fully with the application icon and leaves no ghost icon in the tray.
  
  - Derlenmiş backend exe çalışırken `__dirname` kullanımından kaynaklı oluşan `icon.ico` fiziksel dosya yolu çözümlenme hatası `process.cwd()` kullanılarak giderildi.
  - PowerShell bildirim betiğinin sonuna 4 saniyelik bekleme süresi (`Start-Sleep -s 4`) ve `Dispose()` eklenerek, bildirimin simgeyle birlikte kaybolmadan kalması ve tepside hayalet simge bırakmadan temizlenmesi sağlandı.

### New Features & Improvements / Yeni Özellikler & İyileştirmeler
- **Toast Notification Video Thumbnails / Uygulama İçi Bildirim Önizleme Resimleri:**
  - Enhanced the in-app bottom-right toast notifications (`showToast`) to support rendering the downloaded video's thumbnail dynamically using the local/remote redirect endpoint `/api/video/:videoId/thumbnail`.
  - Updated all download completion, error, cancel, and RSS auto-detect status broadcasts to deliver the matching video's thumbnail metadata.
  - Implemented responsive CSS layouts (`.toast-thumbnail`) for the preview cards to align images beside message content.
  
  - Uygulama içi sağ alttaki bildirimlerin (`showToast`), indirilen videoların önizleme resimlerini (thumbnail) `/api/video/:videoId/thumbnail` üzerinden dinamik olarak göstermesi sağlandı.
  - Tüm indirme başlama/tamamlanma, hata, iptal ve RSS kanal tarama durumu yayınlarına ilgili videonun görsel önizleme yolu eklendi.
  - Toast mesajlarının yanında resimlerin düzgün yerleşmesi için `.toast-thumbnail` sınıfı eklenerek CSS tasarımı güncellendi.

## [5.3.7] - 2026-06-21

### New Features & Improvements / Yeni Özellikler & İyileştirmeler
- **Floating Player Drag/Resize Memory & Orientation Logic / Modal Oynatıcı Boyut & Konum Hafızası:**
  - Added resizable corner handles (`makeElementResizable`) to the floating modal player (`#player-modal`).
  - Implemented separate layout coordinates and dimension storage for standard (landscape) and portrait (Shorts) orientations in `localStorage` to resolve resolution mismatch.
  - Automatically resets coordinates and sizes to default stylesheets (placed at bottom-right based on actual aspect ratio) when opening a video type without stored preferences.
  - Properly managed sizes during minimize/maximize transition to prevent coordinate styling clashes.
  
  - Ufak video oynatıcı modalının (`#player-modal`) köşelerinden (corners) yeniden boyutlandırılabilmesini sağlayan resize tutamaçları (`makeElementResizable`) entegre edildi.
  - Normal (yatay) ve Shorts (dikey) videolar arasındaki çözünürlük/oran uyuşmazlığını gidermek amacıyla koordinat ve boyut verilerinin her video yönelim türüne göre (`localStorage` üzerinde ayrı anahtarlarla) kaydedilmesi sağlandı.
  - Kayıtlı veri olmadığında oynatıcının videonun doğal oranına (aspect ratio) göre otomatik şekil alıp sağ altta açılması sağlandı.
  - Simge durumuna küçültme ve büyütme geçişlerinde özel koordinatların çakışmaması sağlandı.

- **Autoplay Transient HUD Overlay & Player Integration / Otomatik Geçiş Ortada Bildirim & Oynatıcı Geçişi:**
  - Added an Autoplay toggle button (`#inline-btn-autoplay-toggle`) below the player, saving preferences to `localStorage`.
  - Hooked into the `ended` events of Plyr, ArtPlayer, and HTML5 players to automatically fetch and play the next video in the sidebar playlist.
  - Designed a transient, large glassmorphism HUD overlay in the center of the video player when toggling Autoplay, replacing the small bottom-right toast message.
  
  - Oynatıcı eylem barına "Otomatik Geçiş" (Autoplay) butonu eklendi ve seçimin `localStorage`'da saklanması sağlandı.
  - Plyr, ArtPlayer ve HTML5 oynatıcılarının `ended` olaylarına bağlanarak video bittiğinde otomatik sonraki videonun oynatılması sağlandı.
  - Autoplay açılıp kapatıldığında sağ alttaki küçük toast yerine, video oynatıcının tam ortasında şık ve büyük bir geçici katman (transient overlay) şeklinde durum bildirimi eklendi.

- **Light Theme Compatibility / Açık Tema Uyumsuzluklarının Giderilmesi:**
  - Standardized `.modal-content`, `.modal-header h3`, `.modal-close-btn:hover` and `.player-modal-content` elements using theme CSS variables instead of hardcoded dark-blue values. Modals now adapt beautifully to both light and dark themes.
  - Made the transient overlay cards, volume HUD, subtitle translation overlay, and standard toasts light-theme-aware with transparent white backgrounds and dark text.
  
  - Genel modal yapısı, silme onay modalı (`#delete-modal`), çeviri ve oynatıcı modallarındaki hardcoded koyu mavi/beyaz renkler kaldırılarak CSS değişkenlerine bağlandı; modallar açık temada beyaz arka plan ve koyu metin renklerine kavuşturuldu.
  - Geçici katman bildirimleri, ses göstergesi (Volume HUD), altyazı çeviri perdesi ve standart toast bildirimleri açık temada yarı saydam beyaz cam arka plan ve koyu metinlerle temaya tam uyumlu hale getirildi.

- **Single-Instance Protection (C# Launcher) / Tekil Örnek Koruması:**
  - Added a system-level `Mutex` lock check in the C# tray application (`tray.cs`) to prevent multiple launcher processes.
  - When a second instance of `HaYTooL YT Downloader.exe` is launched, it automatically shows a message stating that the app is already running, reads the active port from `configwin.ini`, opens the user's browser to the dashboard, and exits cleanly.
  - Recompiled the C# binary using `csc.exe` with embedded icon and GUI configuration.
  
  - C# tepsi (tray) uygulamasında (`tray.cs`) birden fazla başlatıcı sürecini engelleyecek Mutex yapısı kuruldu.
  - İkinci exe açılmaya çalışıldığında uygulamanın zaten çalıştığını belirtip `configwin.ini` portunu okuyarak tarayıcıda arayüz sekmesini açması ve ikinci süreci sonlandırması sağlandı.
  - C# kodu derlenerek `HaYTooL YT Downloader.exe` dosyası güncellendi.

### Bug Fixes / Hata Düzeltmeleri
- **Localization & UI Translation Corrections / Dil ve Arayüz Çeviri Düzeltmeleri:**
  - Resolved translation bug where Settings card titles ("Çerez & Bildirim" / "Cookie & Notification" and "Otomasyon & RSS" / "Automation & RSS") remained in Turkish when switching interface language to English or other languages.
  - Translated Shorts download preferences ("Shorts İndir" -> "Download Shorts", "Shorts İndirme" -> "Ignore Shorts") dynamically inside the Channels watchlist tab.
  - Dynamically translated default quality options, check/sync action tooltips, logo update tooltips, unfollow button tooltips, and Shorts duration limit options across all 7 supported languages.
  - Localized the main channel filter dropdowns ("All Channels" / "Tüm Kanallar") inside both Library and Downloads tab toolbars.
  
  - Dil seçimi İngilizce veya diğer dillere ayarlandığında Ayarlar sekmesi alt kart başlıklarının ("Çerez & Bildirim" ve "Otomasyon & RSS") Türkçe kalması sorunu giderildi.
  - Kanallar (watchlist) sekmesindeki Shorts indirme seçim kutusu seçenekleri ("Shorts İndir", "Shorts İndirme") ve Shorts süre sınırları dinamik dil çevirisine bağlandı.
  - Takip listesindeki kalite seçimleri, RSS güncelleme, logo güncelleme, takipten çıkar butonlarının durum ipuçları (tooltips) 7 farklı dil için yerelleştirildi.
  - Kütüphane ve İndirilenler sekmelerindeki "Tüm Kanallar" (All Channels) filtre seçenekleri dinamik hale getirildi.

## [5.3.6] - 2026-06-21

### New Features & Improvements / Yeni Özellikler & İyileştirmeler
- **Parallel Downloading & Merging / Paralel İndirme ve Birleştirme:**
  - Refactored `DownloadQueue` to support multiple concurrent background processes (active processes managed via a Map).
  - When a video completes downloading and enters the FFmpeg merging/post-processing phase (detected via stdout matching `[Merger]`, `[ffmpeg]`, or 100% progress), the active network slot is freed (`this.activeDownloads--`) and the next download in the queue starts immediately.
  - Video status transitions to `merging` and updates the database in real-time.
  
  - `DownloadQueue` yapısı, arka planda birden fazla eşzamanlı işlemi (Map tabanlı aktif süreç yönetimi ile) destekleyecek şekilde baştan tasarlandı.
  - Bir video indirmeyi bitirip FFmpeg birleştirme/dönüştürme (merge) aşamasına geçtiğinde (`[Merger]`, `[ffmpeg]` veya %100 ilerleme çıktısıyla algılanır), ağ indirme slotu hemen boşaltılır (`this.activeDownloads--`) ve kuyruktaki sıradaki videonun indirilmesi hemen başlar.
  - Video durumu `merging` olarak güncellenir ve arayüze gerçek zamanlı yansıtılır.

- **Queue UI Revamp & Video Thumbnails / Kuyruk Sekmesi Yenilikleri ve Küçük Resimler:**
  - Redesigned the queue item template to render YouTube video thumbnails (`https://i.ytimg.com/vi/<id>/mqdefault.jpg`) for a richer look.
  - Added a dedicated "Merging (FFmpeg)..." status indicator with a spinning loader animation at the top of the queue list for videos currently being merged.
  - Disabled drag-and-drop ordering for merging videos as their order is locked during processing.
  - Translated all new status states (`status_merging`) across all 7 supported application languages (TR, EN, ES, DE, PT, AR, RU).
  
  - Daha zengin bir görünüm için kuyruktaki her videonun yanına YouTube küçük resmi (thumbnail) gösterimi eklendi.
  - Birleştirme aşamasındaki videolar için kuyruk listesinin en üstünde dönen bir çark (spinner) ve "Birleştiriliyor (FFmpeg)..." durum göstergesi içeren özel kart tasarımı yapıldı.
  - Dönüştürme/birleştirme aşamasındaki videoların sırası kilitlendiğinden sürükle-bırak özelliği bu öğeler için devre dışı bırakıldı.
  - Yeni durum etiketleri (`status_merging`) desteklenen tüm 7 uygulama diline (TR, EN, ES, DE, PT, AR, RU) entegre edildi.

- **Instant Video Seeking / Anlık Video İleri/Geri Sarma:**
  - Refactored the `/api/video-stream` endpoint to use Express's native `res.sendFile(path.resolve(fileToPlay))` method.
  - This allows the browser to natively and efficiently handle HTTP Range requests (HTTP 206) at the C++ level, completely resolving the slow seeking/buffering issues inside embedded video players.
  
  - `/api/video-stream` endpoint'i, Express'in yerleşik ve son derece optimize çalışan `res.sendFile` metoduna geçirildi.
  - Bu sayede tarayıcının HTTP Range isteklerini (HTTP 206) C++ seviyesinde yerel ve önbellekli yönetmesi sağlanarak, gömülü oynatıcılardaki ileri/geri sarma (seek) yavaşlığı ve takılma sorunları tamamen giderildi.

- **Version Bump / Sürüm Güncellemesi:**
  - Version bumped to `v5.3.6` across the project, including package.json, README.md, index pages, settings, and server greeting banner.
  
  - Uygulama genel sürümü `v5.3.6` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi.

## [5.3.5] - 2026-06-20

### New Features & Improvements / Yeni Özellikler & İyileştirmeler
- **Video Description & Timestamps Integration / Video Açıklaması ve Zaman Damgası Entegrasyonu:**
  - Added `--write-description` to yt-dlp arguments, allowing video descriptions to be downloaded as `.description` files inside the video directory.
  - Implemented `/api/video/:videoId/description` GET endpoint to dynamically read and stream the downloaded `.description` text file.
  - Added `#inline-btn-description` toggle button on the player controls and `#inline-player-description-container` sidebar panel to display the description.
  - Automatically parses time durations (`hh:mm:ss` / `mm:ss`) inside the description into clickable hyperlink anchors that trigger seek actions on ArtPlayer, Plyr, and HTML5 players.
  - Integrated cleanup commands in `autoDeleteOldVideos` and deletion endpoints to automatically sweep `.description` files along with video tracks.

  - Video dizinine açıklamaların `.description` dosyası olarak kaydedilmesi için yt-dlp argümanlarına `--write-description` parametresi eklendi.
  - İndirilen `.description` metin dosyasını dinamik olarak okuyup sunan `/api/video/:videoId/description` GET endpoint'i oluşturuldu.
  - Oynatıcı kontrollerine `#inline-btn-description` (Açıklama Göster) butonu ve arayüze açıklama metnini gösterecek dikey kaydırılabilir `#inline-player-description-container` paneli eklendi.
  - Açıklama metnindeki zaman damgaları (`hh:mm:ss` / `mm:ss`) otomatik olarak algılanıp ArtPlayer, Plyr ve HTML5 oynatıcılarında süreye atlama (seek) eylemini tetikleyen tıklanabilir bağlantılara dönüştürüldü.
  - Video silme ve otomatik temizleme (`autoDeleteOldVideos`) logic'ine, videolarla birlikte `.description` ve altyazı dosyalarının da sistemden silinmesini sağlayan temizleme komutları entegre edildi.

- **Fixed Description File Matching Bug / Açıklama Dosyası Eşleşme Hatası Düzeltildi:**
  - Resolved the bug where the newly introduced `.description` files were mistakenly matched as the main video file instead of `.mp4`/`.webm`, causing playback failures (`NotSupportedError`). Added `.description` to the video file exclusion lists on the server.

  - Yeni eklenen `.description` dosyalarının, `.mp4`/`.webm` yerine ana video dosyası gibi eşleşmesine ve oynatma hatalarına (`NotSupportedError`) yol açan hata giderildi. Sunucu üzerindeki video dosyası filtreleme listelerine `.description` uzantısı eklendi.

- **UI Language Synchronization / Arayüz Dil Senkronizasyonu:**
  - Added translations for `tab_iptv`, `inline_btn_description`, and `inline_description_title` tags across all supported application languages.
  - Hooked language change events to dynamically update translations for the IPTV tab menu and the player description button/panel text on runtime.

  - Desteklenen tüm uygulama dillerine `tab_iptv`, `inline_btn_description` ve `inline_description_title` etiketlerinin çevirileri eklendi.
  - Dil değişim olayları (language change) IPTV tab menüsü, oynatıcı açıklama butonu ve panel başlığı metinlerini anlık olarak güncelleyecek şekilde dil mantığına bağlandı.

- **Version Bump / Sürüm Güncellemesi:**
  - Version bumped to `v5.3.5` across the project, including package.json, README.md, index pages, settings, and server greeting banner.

  - Uygulama genel sürümü `v5.3.5` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi.

## [5.3.4] - 2026-06-20

### New Features & Improvements / Yeni Özellikler & İyileştirmeler
- **IPTV Sports Mode & Layout Enhancements / IPTV Spor Modu ve Yerleşim Geliştirmeleri:**
  - Added seamless fullscreen scaling for Slot 1 and automatic centering of video players.
  - Implemented stream swapping (URL/name swap) between Slot 0 and Slot 1, keeping player sizes and custom resize states intact.
  - Slot 1 auto-unmutes and Slot 2 (PiP overlay) auto-mutes upon swapping to prevent audio clutter.
  - Added overlay controls for mute/unmute and swap directly on video slots.
  - Added hotkey support ('s'/'S'/'y'/'Y') to quickly swap screens in Sports Mode.
  - Custom drag and resize states now persist properly.

  - Slot 1 için kesintisiz tam ekran ölçeklendirme ve video oynatıcıların otomatik ortalanması eklendi.
  - Slot 0 ve Slot 1 arasında oynatıcı boyutlarını ve özel boyutlandırma durumlarını bozmayan kanal/isim yer değiştirme (swap) özelliği eklendi.
  - Ses karmaşasını önlemek için yer değiştirme sonrasında Slot 1 sesi otomatik açılırken Slot 2 (PiP) sesi otomatik olarak kısılır.
  - Video slotlarının üzerine doğrudan sessize alma ve yer değiştirme butonları eklendi.
  - Spor Modundayken hızlıca ekranları yer değiştirmek için klavye kısayolu ('s'/'S'/'y'/'Y') desteği eklendi.
  - Özel sürükleme ve yeniden boyutlandırma konumlarının kaybolmadan korunması sağlandı.

- **UI & Navigation Refinements / Arayüz ve Navigasyon İyileştirmeleri:**
  - Removed "HaYTooL YouTube Downloader" text from the header bar, keeping only the logo and version badge.
  - Added IPTV navigation tab to the header. Re-ordered navigation tabs as: Logo/Version/Kütüphane/İndirilenler/IPTV/Kuyruk/Kanallar/PD/Ayarlar.
  - Shrinked view mode buttons on the IPTV panel for a cleaner look.
  - Truncated category filter names to 40 characters maximum to prevent layout distortion.
  - Removed GitHub update confirmation dialog for a smoother user experience.

  - Başlık barından "HaYTooL YouTube Downloader" metni kaldırılarak sadece logo ve versiyon rozeti bırakıldı.
  - Başlık menüsüne IPTV sekmesi eklendi. Navigasyon sırası şu şekilde düzenlendi: Logo/Version/Kütüphane/İndirilenler/IPTV/Kuyruk/Kanallar/PD/Ayarlar.
  - Daha temiz bir görünüm için IPTV panelindeki görünüm modu butonları küçültüldü.
  - Tasarımın bozulmasını önlemek için kategori filtre isimleri maksimum 40 karakter ile sınırlandırıldı.
  - Daha akıcı bir kullanıcı deneyimi için GitHub güncelleme onay kutusu kaldırıldı.

- **Version Bump / Sürüm Güncellemesi:**
  - Version bumped to `v5.3.4` across the project, including package.json, README.md, index pages, settings, and server greeting banner.

  - Uygulama genel sürümü `v5.3.4` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi.

## [5.1.0] - 2026-06-18

### Bug Fixes & Improvements / Hata Düzeltmeleri & İyileştirmeler
- **Vertical Video Zooming Fix / Dikey Video Yakınlaşma Hatası Düzeltildi:**
  Fixed the issue where playing vertical (Shorts) videos inside the embedded inline player in the downloaded tab resulted in cropped and zoomed playback. Added custom layout and CSS rules to maintain correct 9:16 aspect ratio while preventing cropping.

  İndirilenler sekmesindeki yerleşik video oynatıcıda dikey (Shorts) videolar oynatılırken yaşanan kırpılma ve yakınlaşma (zoom) hatası giderildi. Videonun 9:16 en-boy oranını koruyarak düzgün ve kırpılmadan gösterilmesi için özel stil ve yerleşim kuralları eklendi.
- **Default Channel Auto-Download Disabled / Varsayılan Kanal Otomatik İndirmesi Kapatıldı:**
  Disabled the auto-download setting for the default channel "TeknoSeyir" by default on initial launch. This prevents downloads from starting immediately when a new user runs the app.

  İlk kurulumda varsayılan olarak gelen "TeknoSeyir" kanalının otomatik indirme seçeneği kapatıldı. Böylece kullanıcının yazılımı ilk açtığında habersizce indirmelerin başlaması engellenmiş oldu.
- **Upcoming/Live Video Label Localization / Yakında/Canlı Video Etiketi Yerelleştirmesi:**
  Translated the "upcoming" and "live" video duration/status labels in the library card to respect the application language (Turkish/English).

  Kütüphane kartında yayınlanacak olan (planlanmış) ve canlı yayındaki videoların "upcoming" ve "live" olan İngilizce etiketleri, seçilen uygulama diline göre (Türkçe ise "Yakında" / "Canlı") yerelleştirildi.
- **Version Upgrade / Sürüm Güncellemesi:**
  Version bumped to `v5.1.0` across the project, including package.json, README.md, index pages, settings, and server greeting banner.

  Uygulama genel sürümü `v5.1.0` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi.

## [5.0.0] - 2026-06-18

### New Features & Improvements / Yeni Özellikler & İyileştirmeler
- **GitHub Automatic Update Notification / GitHub Otomatik Güncelleme Bildirimi:**
  Added a background GitHub update checker that runs at server startup and every 12 hours. Shows a sleek, animated, and dismissible glassmorphism toast notification at the bottom-right corner of the screen when a newer release is published, plus an "Update Available" badge in the Settings panel linking to the GitHub releases page.
  Sunucu başlangıcında ve her 12 saatte bir arka planda en güncel GitHub Releases API sürümünü denetleyen ve yeni bir sürüm çıktığında arayüzün sağ alt köşesinde glassmorphism tarzında, animasyonlu ve kapatılabilir bir güncelleme uyarısı gösteren yeni sistem eklendi. Ayrıca Ayarlar sekmesindeki sürüm numarasının yanına "Güncelleme Var" rozeti eklendi.
- **Version Upgrade / Sürüm Güncellemesi:**
  Version bumped to `v5.0.0` across the project, including package.json, README.md, index pages, settings, and server greeting banner.
  Uygulama genel sürümü `v5.0.0` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi.

## [4.29.0] - 2026-06-18

### Bug Fixes & Improvements / Hata Düzeltmeleri & İyileştirmeler
- **FFmpeg Installation Timeout Fix / FFmpeg Kurulum Zaman Aşımı Hatası Giderildi:**
  Fixed intermittent validation timeout failures (`ETIMEDOUT`) during initial FFmpeg extraction caused by Windows Defender / antivirus scanning new binary executables. Increased validation timeout in `testFfmpegSync()` from 2 seconds to **10 seconds**, and implemented a **5-second delay followed by an automatic retry** (with a 5-second timeout) if a timeout occurs.
  İlk FFmpeg kurulumu/çıkarma işleminden sonra Windows Defender / Antivirüs programlarının yeni binary dosyalarını taramasından kaynaklanan 2 saniyelik zaman aşımı (`ETIMEDOUT`) hataları giderildi. `testFfmpegSync()` fonksiyonundaki doğrulama zaman aşımı süresi **10 saniyeye** çıkarıldı. Ayrıca zaman aşımı hatası alındığında antivirüs taramasının tamamlanabilmesi için **5 saniye beklenip otomatik bir kez yeniden deneme (retry)** mekanizması eklendi.
- **Version Upgrade / Sürüm Güncellemesi:**
  Version bumped to `v4.29.0` across the project, including package.json, README.md, index pages, settings, and server greeting banner.
  Uygulama genel sürümü `v4.29.0` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi.

## [4.28.0] - 2026-06-18

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Taşınabilir Sürüm Paketleyici İyileştirmesi (db.json Hariç Tutulması) / Portable Release Packager Refinement (db.json Exclusion):** Taşınabilir zip paketleme betiği (`releases-maker.ps1`) güncellenerek kişisel indirme geçmişinizi ve takip edilen kanallar listesini barındıran `db.json` dosyasının dağıtılan zip arşivlerine yanlışlıkla dahil edilmesi engellendi. Bu sayede, yeni sürümler sıfır veritabanı dosyalarıyla başlayarak temiz bir kurulum sağlar. / Updated the portable release packager script (`releases-maker.ps1`) to automatically exclude the local database file (`db.json`) from being compiled into distribution zip archives. Ensures clean installations without local history files.
- **Sürüm Güncellemesi / Version Upgrade:** Uygulama genel sürümü `v4.28.0` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi. / Version bumped to `v4.28.0` across the project, including package.json, README.md, index pages, settings, and server greeting banner.

## [4.27.0] - 2026-06-18

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Varsayılan İndirme Klasörü Konumu (Sistem Downloads Klasörü) / Default Download Location (System Downloads Folder):** Temiz kurulumlarda veya INI ayarları bulunmadığında, varsayılan indirme konumu proje klasöründeki `/download` dizininden sistemin genel Downloads (İndirilenler) dizininin altındaki `HaYTooLYouTubeAutoDownloads` konumuna taşındı (örn. `C:\Users\<Username>\Downloads\HaYTooLYouTubeAutoDownloads`). Klasör açılışta yoksa sistem tarafından otomatik olarak oluşturulacaktır. / Changed the default fallback download path from the local `/download` folder inside the project directory to the user's system Downloads folder, under a dedicated subdirectory named `HaYTooLYouTubeAutoDownloads`. The folder is dynamically resolved using the user's home directory and created automatically on startup if missing.
- **Sürüm Güncellemesi / Version Upgrade:** Uygulama genel sürümü `v4.27.0` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi. / Version bumped to `v4.27.0` across the project, including package.json, README.md, index pages, settings, and server greeting banner.

## [4.26.0] - 2026-06-18

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **İlk Çalışmada Varsayılan Kanal (TeknoSeyir) / Default Channel on First Run (TeknoSeyir):** Uygulamanın veritabanı bulunmadığı ilk kurulum/çalışma anında, takip edilen kanallar listesinin boş gelmesi yerine varsayılan olarak "TeknoSeyir" kanalı yüklü gelecek şekilde `defaultDb` şablonu güncellendi. Kanalın avatar, kanal adresi, otomatik indirme ve süre limitleri gibi bilgileri önceden tanımlı olarak gelir. / Updated the default database template (`defaultDb`) so that when the application is launched for the first time without a pre-existing `db.json` database, the followed channels list is pre-populated with the "TeknoSeyir" channel. Configures its avatar, YouTube handle, auto-download setting, and defaults out-of-the-box.
- **Sürüm Güncellemesi / Version Upgrade:** Uygulama genel sürümü `v4.26.0` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi. / Version bumped to `v4.26.0` across the project, including package.json, README.md, index pages, settings, and server greeting banner.

## [4.25.0] - 2026-06-18

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Çalışma Dizini ve İkon Düzeltmesi (Sistem Başlangıcı) / Working Directory & Icon Resolution (System Startup):** C# Tray uygulamasının (`HaYTooL YT Downloader.exe`) Windows başlangıcında (`Run` Registry anahtarı) tetiklendiğinde çalışma dizininin `C:\Windows\System32` olarak belirlenmesinden kaynaklanan `icon.ico` ve `configwin.ini` dosyalarını bulamama hatası giderildi. Çalışma dizini program başlangıcında dinamik olarak uygulamanın kendi klasörüne sabitlendi. / Fixed the startup registry launch issue where Windows set the working directory to `C:\Windows\System32`, causing relative assets like `icon.ico` and `configwin.ini` to fail loading. Now, the application sets its current directory to the executable's directory at launch.
- **Kendi Tarayıcısında Aç Seçeneği (Edge App Modu) / Open in Own Browser (Edge App Mode):** Tepsi sağ tık menüsüne gömülü tarayıcı deneyimi sunan "Kendi Tarayıcısında Aç" (Open in App Window) seçeneği eklendi. Bu seçenek, Microsoft Edge'i `--app` parametresi ile bağımsız, chromeless (adres çubuğu ve sekmeleri olmayan) bir pencere modunda açarak yerleşik bir masaüstü uygulaması görünümü sağlar. Tepsi ikonuna çift tıklama eylemi ise varsayılan sistem tarayıcısını açmaya devam eder. / Added "Open in Own Browser" option to the tray right-click menu, launching MS Edge in `--app` mode for a dedicated chromeless window experience, mimicking a standalone desktop app. Double-clicking the tray icon continues to open the default system browser.
- **Dil Çevirileri ve Sadeleştirmeler / Localization Updates & Refinements:** "Kendi Tarayıcısında Aç" seçeneği tr, en, es, de, pt, ru ve ar dillerinde yerelleştirildi. Ayrıca Türkçe menüdeki "Panodan İndir (Paste & Download)" seçeneği "Panodan İndir" olarak sadeleştirildi. / Localized the "Open in Own Browser" text across all supported languages. Simplified the Turkish menu item "Panodan İndir (Paste & Download)" to simply "Panodan İndir".
- **Sürüm Güncellemesi / Version Upgrade:** Uygulama genel sürümü `v4.25.0` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi. / Version bumped to `v4.25.0` across the project, including package.json, README.md, index pages, settings, and server greeting banner.

## [4.24.0] - 2026-06-18

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Kütüphane Filtre Düzeni ve Tasarım Düzeltmeleri / Library Filter Bar & Styling Refinements:** Tarih filtreleri için kullanılan select dropdown yapısı, butonla seçimin daha hızlı olması nedeniyle tekrar eski butonlu tasarıma geri döndürüldü. Tarih butonları (`btn-filter`) son derece kompakt hale getirilerek tüm filtre barının tek satıra sığması sağlandı. / Reverted the quick date filters back to the button layout from the select dropdown based on usability preferences, making them ultra-compact to ensure they neatly fit on a single line.
- **İndirilenler Çalma Listesi Dinamik Yükseklik / Downloads Playlist Dynamic Height:** İndirilenler sekmesindeki sağ tarafta yer alan çalma listesi sidebarı (`.inline-player-sidebar` ve `.downloaded-playlist-grid`), içindeki video adedine göre otomatik olarak uzayacak şekilde (scrollsuz/limitsiz) dinamik yüksekliğe kavuşturuldu. / Adjusted the downloaded playlist sidebar to dynamically expand to fit the total number of videos without internal scrolling or fixed max-height limitations.
- **Sürüm Güncellemesi / Version Upgrade:** Uygulama genel sürümü `v4.24.0` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi. / Version bumped to `v4.24.0` across the project, including package.json, README.md, index pages, settings, and server greeting banner.

## [4.23.0] - 2026-06-18

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Kanal Özelinde Otomatik İndirme Ayarı / Per-Channel Auto-Download Toggle:** Takip edilen kanalların listesinde her kanala özel otomatik video indirme seçeneği eklendi. Yeni eklenen kanallarda varsayılan olarak otomatik indirme (`autoDownload: true`) açık olacak şekilde yapılandırıldı. Bu sayede tüm otomasyon açıkken belirli kanalların otomatik indirmesi kapatılabilir. / Added a select dropdown next to each followed channel to toggle auto-downloads on a per-channel basis. Newly added channels default to having auto-download enabled. Enables selective auto-downloading even when global auto-downloads are active.
- **SponsorBlock Anlık Kapatma Butonu / SponsorBlock Temporary Skip Toggle:** Video oynatıcısının altındaki eylem barına SponsorBlock atlamasını anlık olarak kapatıp açan dinamik bir kalkan (`shield` / `shield-off`) butonu eklendi. Butona tıklanarak geçerli video oynatım oturumu için sponsor atlamaları geçici olarak devre dışı bırakılabilir ve timeline üzerindeki sponsor şeritleri soluklaştırılır. / Integrated a dynamic shield button under the video player to temporarily pause or enable SponsorBlock segment skipping for the current video. Diminshes timeline sponsor segments visibility when disabled.
- **Ses Seviyesi & SponsorBlock Görsel Bildirimleri / Volume & SponsorBlock Transient HUD Overlays:** Mouse scroll tekerleğiyle ses değiştirildiğinde ve SponsorBlock kalkan butonuna tıklandığında, oynatıcı üzerinde yarım saniyede sönen şık cam tasarımlı (glassmorphic) görsel bildirim katmanları (HUD) eklendi. / Introduced sleek, transient glassmorphic HUD overlays on the player to show volume level changes (when using the scroll wheel) and SponsorBlock status notifications when toggled.
- **Kütüphane Otomatik İndirme Filtresi / Library Auto-Download Disabled Filter:** Kütüphane tabına, sadece otomatik indirmesi devre dışı bırakılmış kanalların videolarını listelemek amacıyla "Sadece Otomatik İndirme Kapalı" filtresi (`history-only-no-auto-download`) eklendi. / Added an "Only Auto-Download Disabled" filter checkbox on the Library tab to display only the videos belonging to channels that have auto-downloads disabled.
- **Tekil & Senkronize Oynatıcı Yönetimi / Single Synchronized Player Management:** Arayüzdeki yerleşik ve modal oynatıcıların çift ses çalmasını engellemek için tüm oynatıcılar senkronize hale getirildi. Bir sekmedeki video duraklatıldığında diğer sekmeye geçince kendiliğinden başlamayacak; modal veya yerleşik yeni bir video açıldığında arka plandaki tüm video/ses oynatımları ve iframeler tamamen durdurulup yok edilecektir. / Overhauled player lifecycle management to prevent dual audio playback. If a video is paused, switching tabs will keep the player paused instead of autoplaying. Opening a new video (inline or floating) instantly pauses, stops, and destroys all other active media and iframe elements.
- **Dil Çevirileri Entegrasyonu / Multi-Language Translation Updates:** Yeni eklenen özellikler, seçenek başlıkları, tooltipler, HUD başlıkları ve durum etiketleri tr, en, es, de, pt, ru ve ar dil dosyalarına eksiksiz şekilde entegre edildi. / Fully integrated translation keys and localizations for the new toggles, options, tooltips, HUD labels, and state descriptions across all 7 supported languages.
- **Sürüm Güncellemesi / Version Upgrade:** Uygulama genel sürümü `v4.23.0` olarak güncellendi, README ve anasayfa/ayarlar menüsü versiyon etiketleri güncellendi. / Version bumped to `v4.23.0` across the project, including README, index pages, server greeting banner, and settings.

## [4.22.0] - 2026-06-16

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Gelişmiş Altyazı Çeviri Modalı & Yükleme Ekranı / Advanced Subtitle Translation Modal & Loading Overlay:** Altyazı çeviri butonu (`inline-btn-translate-sub`) tamamlanmış videolarda her zaman görünür olacak şekilde güncellendi. Butona tıklandığında kaynak altyazı dosyası (örn: `.en`, `.es` vb.) ile hedef dilin (TR, EN, ES, DE, PT, AR, RU, FR, IT, JA, ZH) seçilmesini sağlayan şık bir modal açılır. Çeviri esnasında donmayı veya çalışmama hissini önlemek için oynatıcı alanında dönen spinner ve seçilen dile göre yerelleştirilmiş durum overlay katmanı gösterilir. Backend dinamik kaynak/hedef çevirisini destekleyecek şekilde güncellendi. / Updated the subtitle translation button to be always visible on completed videos. Clicking it opens a modal allowing the user to select the source subtitle track and the target language (supporting 11 languages). Displays a localized visual loading overlay with a spinning loader and descriptive text during the API translation process. Backend updated to support generic source/target language parameters.
- **İkon Arayüzü / Icon-Only Action Buttons:** Video altındaki "YouTube'da Aç", "Sistem Oynatıcısında Aç", "Klasör Aç" ve "Yorumları Göster" butonlarındaki metin etiketleri silinerek sadece modern ikonlar bırakıldı. İlgili açıklamalar tooltip (`title`) olarak dile göre dinamik atanır. YouTube logosu kırmızı (`#ff0000`) yapıldı. / Removed text labels from the player action buttons to show icons only. Dynamic tooltips are assigned based on language. YouTube icon is now styled with its native red (#ff0000) fill.
- **Zengin Altyazı Seçenekleri / Rich Subtitle Options:** Altyazı rengi (12 adet renk seçeneği: Mavi, Turuncu, Mor, Siyah, Gri, Açık Sarı dahil), altyazı saydamlığı (%0'dan %100'e 12 farklı seçenek) ve altyazı yazı boyutu (12px'ten 40px'e 13 farklı seçenek) seçenekleri en az 12 adet seçeneğe yükseltildi. / Expanded subtitle options to offer at least 12 choices for each control: 12 colors, 12 opacity percentages, and 13 font sizes, synchronized across both inline selects and ArtPlayer settings.
- **Dil Çevirileri Revizyonu / Translation Quality Polish:** Uygulama dillerinde (tr, en, es, de, pt, ru, ar) yeni altyazı renk, saydamlık ve boyut değerlerinin, butonların ve tooltiplerin çevirileri eksiksiz şekilde senkronize edildi. / Fully audited and updated translations for all 7 languages (TR, EN, ES, DE, PT, AR, RU) to cover newly added controls, color names, opacities, and sizes.
- **Sürüm Güncellemesi / Version Upgrade:** Uygulama genel sürümü `v4.22.0` yapıldı, README ve anasayfa/ayarlar güncellendi. / Version bumped to `v4.22.0` across README, index pages, server greeting banner, and settings.

## [4.21.0] - 2026-06-16

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Yorum Avatar ve Tasarım İyileştirmesi / Comment Avatar & Bubble Polish:** Yorum bölümündeki büyük ve uyumsuz avatarlar küçültüldü ve yorum balonları modern, şık ve görsel açıdan kusursuz bir tasarıma kavuşturuldu. / Shrank and redesigned comment avatars and bubble layouts in the comments panel to look visually consistent, clean, and premium.
- **Oynatıcı İçi Gelişmiş Ayarlar / Inline Player Advanced Controls:** Yerleşik oynatıcı alt kontrol barına; Altyazı Rengi seçici, Altyazı Arka Plan Saydamlığı (%0 ile %100 arası) seçici, Altyazı Yazı Boyutu seçici ve tamamlanmış videoları diskten silip sıfırdan indirilmek üzere kuyruğa alan "Tekrar İndir" (Redownload) butonu eklendi. / Integrated inline controls directly into the player action bar: Subtitle Color dropdown, Subtitle Background Opacity selection, Subtitle Font Size selector, and a "Redownload" button which deletes existing files and re-queues the video.
- **ArtPlayer Kısayol Düzeltmesi / ArtPlayer Shortcut Resolution:** ArtPlayer gömülü oynatıcıda Space (oynat/durdur) ve yön tuşları gibi klavye kısayollarının çift tetiklenip çakışması `hotkey: false` ayarı ile giderildi. / Resolved double-toggle keyboard shortcut conflicts (like Space and arrow keys) in ArtPlayer by setting `hotkey: false` and cleanly delegating to global handlers.
- **İndirilenler Sıralama ve Shorts Filtreleri / Downloads Sorting & Shorts Filters:** Sağ taraftaki çalma listesi sidebarı "İndirilenler" (Downloads) olarak adlandırıldı. Kanal adının yanına dosya boyutu ve yüklenme tarihi eklendi. Üst kısımdaki açılır filtre menüleri yerine yan yana hızlı sıralama butonları (Tarih ve Boyut yön oklarıyla) ile "Shorts Göster" seçeneği konuldu ve bu ayarların anlık olarak çift yönlü senkronize çalışması sağlandı. / Renamed the sidebar playlist header to "Downloads", showing file size and publication date next to the channel name. Replaced dropdown selectors with side-by-side quick sort buttons (Date/Size toggles) and a Shorts checkbox, enabling instant bi-directional sorting and filtering.

## [4.20.0] - 2026-06-16

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Altyazı Özelleştirmeleri / Subtitle Color Customization:** ArtPlayer, Plyr ve HTML5 video oynatıcılarına altyazı renk seçeneği (Altyazı Rengi) eklendi. Hem genel ayarlar sekmesinde hem de ArtPlayer içi ayar menüsünde (YouTube benzeri çark menüsü) altyazı rengi değiştirilebiliyor. / Added subtitle color selection (Subtitle Color) to ArtPlayer, Plyr, and HTML5 players. Subtitle colors can be configured via both the global Settings tab and directly within the ArtPlayer settings menu.
- **Eşzamanlılık Koruması / Database Concurrency Protection:** Eşzamanlı (asenkron) veritabanı yazma çakışmalarını (DB Lock) engellemek amacıyla asenkron kilit (Mutex) mekanizması entegre edildi. / Integrated an asynchronous DB lock mutex to serialize write operations and prevent concurrency database locks.
- **Güvenlik İyileştirmeleri / Path Traversal Security:** Klasör açma endpoint'inde (`/api/open-folder`) path traversal zafiyetlerine karşı güvenli yol denetimi ve doğrulama eklendi. / Secured the folder opening endpoint (`/api/open-folder`) against path traversal attacks using path validation.
- **Kanal Logo & Arayüz Sadeleştirmeleri / Metadata Cleanups:** İndirilenler sekmesindeki video kartlarında ve inline oynatıcıda kanal adı yanında duran tv ikonu kaldırıldı. / Removed the TV icon next to the channel name in both downloaded cards and the inline player view.

## [4.19.0] - 2026-06-15

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Çoklu Dil Altyazı Desteği / Multi-language Subtitles Support:** Video indirilirken Türkçe ve İngilizce altyazı dosyalarının (`.tr.srt` ve `.en.srt`) otomatik olarak indirilmesi ve video dosyasıyla aynı klasörde aynı isimle kaydedilmesi sağlandı. / Enabled automatic downloading of Turkish and English subtitles (`.tr.srt` and `.en.srt`) alongside videos. They are saved in the same directory using matching file names.
- **Akıllı Silme Mekanizması / Smart Subtitle Deletion:** Arayüzden bir video diskten silindiğinde, o videoya ait `.tr.srt`, `.en.srt` veya diğer tüm altyazı uzantıları otomatik olarak algılanıp video dosyasıyla birlikte temizlenir. / Implemented smart cleanup which automatically deletes associated `.tr.srt`, `.en.srt`, and other subtitle formats when a video is deleted via the interface.
- **Oynatıcılarda Dinamik Altyazı Menüsü & CC Butonu / Dynamic Subtitles Menu & CC Button in Players:** ArtPlayer, Plyr ve HTML5 oynatıcılarına dinamik altyazı dili seçme menüsü ve CC açma/kapatma butonları entegre edildi. Altyazılar stream edilerek oynatıcılara WebVTT biçiminde dinamik sunulmaktadır. / Integrated a dynamic subtitles selection menu and CC toggles into ArtPlayer, Plyr, and HTML5 players. Subtitles are dynamically converted to WebVTT format and streamed to the players.
- **Hata Dayanıklılığı ve Varlık Doğrulama / Error Resilience & Video Verification:** Altyazı indirme aşamasında oluşabilecek ağ veya 429 rate limit hataları yt-dlp indirme sürecini durdurmasın diye `--ignore-errors` eklenerek video indirme kararlılığı sağlandı. İndirme sonrasında video dosyasının diskteki varlığı doğrulanıp dosya yoksa durum başarısız olarak işaretlenir. / Added `--ignore-errors` to yt-dlp arguments to prevent subtitle rate-limit errors (e.g. 429) from aborting the video download. Added file existence checks to ensure successful video compilation on disk before marking downloads as completed.
- **Arayüz Odaklı Otomatik Yukarı Kaydırma / Automatic Scroll-to-Top:** İndirilenler sekmesindeki videoya tıklandığında veya sekmeler arasında geçiş yapıldığında, sayfanın dikey kaydırma konumu otomatik olarak en üste kaydırılarak video oynatıcının ekrana tam oturması sağlandı. / Added auto-scroll to top when clicking downloaded video items or switching tabs, ensuring the inline player starts fully visible in the viewport.

## [4.18.0] - 2026-06-15

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Windows Job Objects Entegrasyonu / Windows Job Objects Integration:** C# tepsi uygulaması (`tray.cs`) ve backend sürecine Windows Job Objects eklendi. Bu sayede tray kapatıldığında, çöktüğünde veya sonlandırıldığında, arka plandaki tüm backend ve alt süreçler (yt-dlp, ffmpeg) Windows tarafından yetim kalmadan otomatik temizlenir. / Integrated Windows Job Objects into the tray wrapper (`tray.cs`) to ensure the Node backend and all child processes (yt-dlp, ffmpeg) are automatically terminated by Windows if the parent tray application exits, crashes, or is killed.
- **YouTube Tarzı Bölünmüş Yerleşik Oynatıcı / YouTube-Style Split Inline Player:** İndirilenler sekmesinde video oynatılırken floating modal yerine, YouTube benzeri dikey iki sütunlu bir yerleşik oynatıcı düzeni devreye girer. Sol üstte aktif oynatıcı, sağında/altında indirilmiş diğer videoların çalma listesi sidebarı listelenir. / Implemented a YouTube-style split two-column layout for the Downloaded Videos tab. Clicking a downloaded video plays it in an inline player on the left, with other downloaded videos listed in a sidebar playlist on the right.
- **Dinamik Çalma Listesi & Filtre Entegrasyonları / Dynamic Playlist & Sidebar Filters:** Oynatma listesi sidebar'ının üst kısmına Tarih ve Boyut bazlı sıralama, Kanal Filtreleme ve Shorts videolarını göster/gizle seçenekleri eklendi. Bu filtreler ana listedeki filtrelerle çift yönlü senkronize çalışmaktadır. / Added Sorting (date/size), Channel Filter, and Shorts visibility toggle controls directly on top of the playlist sidebar. These filters sync bi-directionally with the main downloaded list filter parameters.
- **Klasör Aç Butonu ve Yerleşim İyileştirmeleri / Folder Button & Sizing Adjustments:** İndirilenler sekmesi üstündeki başlık ve açıklama metinleri kaldırılarak oynatıcının en üste sığması sağlandı. "İndirilenler Klasörünü Aç" butonu ise üst bar (topbar) içerisine ufak bir klasör simgesi olarak taşındı. Oynatıcının en-boy oranı 16:9 olarak sabitlenerek geniş ekranlardaki sağ-sol siyah barlar tamamen giderildi. / Removed downloaded tab headers to align player to the very top. Relocated the "Open Downloads Folder" button to the topbar as a clean icon-only button. Fixed player aspect ratio to strictly preserve 16:9 layout, preventing pillarbox/letterbox black bars on wider monitors.
- **Yerleşik Oynatıcı Klavye Kısayolları / Keyboard Shortcuts for Inline Player:** Gömülü oynatıcı klavye kısayollarının (Space ile durdur/oynat, yön tuşlarıyla sarma vb.) yerleşik oynatıcıda da çalışması sağlandı. / Enabled global player keyboard shortcuts (Space for play/pause, Arrow keys for seek, F for fullscreen, etc.) for the inline player layout.

## [4.17.0] - 2026-06-05

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **SponsorBlock Oynatıcı Entegrasyonu / SponsorBlock Player Integration:** Ayarlar sekmesine yeni eklenen "SponsorBlock (Oynatıcı)" seçeneği sayesinde, yerel video dosyalarına dokunulmadan gömülü oynatıcıda (Plyr, ArtPlayer, HTML5) izleme esnasında sponsorlu ve reklam kısımları otomatik atlatılır. / Integrated SponsorBlock natively into the web player modal. A toggle button in the Settings menu lets you automatically skip sponsored segments and self-promotions in real-time for Plyr, ArtPlayer, and HTML5 players, without modifying the underlying downloaded files.
- **ArtPlayer Sponsor İşaretçileri / ArtPlayer Highlight Marks:** ArtPlayer seçili olduğunda atlatılacak sponsorlu kısımlar video ilerleme çubuğu (timeline) üzerinde görsel olarak işaretlenir. / When using ArtPlayer, skip segments are visually marked on the progress timeline.
- **Oynatıcı Sponsor Durum Çubuğu / Player Sponsor Status Bar:** Oynatıcı modalının başlığı altında, videodaki aktif sponsor segmentlerini ve atlanacak alanların sayısını gösteren küçük bir durum çubuğu eklendi. / Added a subtle status bar under the player title to display detected sponsor segments and skipping states.

## [4.16.0] - 2026-06-05

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Veritabanı RAM Önbelleklemesi / Database RAM Caching:** `db.json`, `configwin.ini` ve `channels.ini` dosyalarının son değişiklik tarihleri (`mtimeMs`) denetlenerek, disk üzerinde değişiklik olmadığında verinin doğrudan RAM önbelleğinden dönülmesi sağlandı. Disk I/O ve JSON ayrıştırma işlem yükü büyük oranda azaltıldı. / Implemented an in-memory cache for the database. The server now checks the modification time of the database and INI files, bypassing disk reads and parsing if they haven't changed.
- **Log Dosyası Rotasyonu / Log Rotation:** Aktif log dosyası boyutu `10MB` limitini aştığında, dosya otomatik olarak `.log.bak` şeklinde yedeklenip yeni bir temiz log dosyasına geçilerek disk doluluğu kontrol altına alındı. / Added automatic log file rotation. When the current log file size exceeds 10MB, it is backed up to `.log.bak` and a fresh log file is created.
- **Yerel Ağ Güvenlik Sınırlandırması / Localhost Network Binding:** Express sunucusunun ağ dinleme arabirimi `127.0.0.1` (localhost) olarak sınırlandırıldı. Dış ağlardan gelebilecek yetkisiz indirme paneli erişimleri engellendi. / Bound the Express server listener exclusively to `127.0.0.1` (localhost) to prevent unauthorized remote access to the downloader dashboard from the local network.

## [4.15.0] - 2026-06-05

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Kütüphane Hızlı Tarih Filtreleri / Library Quick Date Filters:** Kütüphane sekmesinde kanal filtreleri ve Shorts gösterimiyle aynı satırda yer alan hızlı süzme butonları ("Bugün", "Dün", "Son 2/3/4/5 Gün") eklendi. Filtreler tüm dil paketlerinde dinamik çalışmaktadır. / Added quick-filter buttons to the Library tab, aligned on the same row as the channel selector and shorts toggle, to dynamically filter videos by Today, Yesterday, or the Last 2/3/4/5 Days.
- **Seçici Dosya Boyutu Gösterimi / Selective File Size Display:** İndirilmemiş videoların altında gösterilen "Boyut: -- MB" etiketi gizlenerek liste temizliği sağlandı. İndirilmiş (tamamlanmış) videolarda boyut gösterimi aynen devam etmektedir. / Hidden the "Size: -- MB" label under undownloaded videos to declutter the list, while keeping it active for completed downloads.
- **Dinamik Kanal Logoları / Dynamic Channel Avatars:** Kütüphane ve İndirilenler sekmelerinde kanal isminin solundaki tv simgesi, dairesel ve renkli kanal profil avatar resmiyle değiştirildi. Logo bulunamadığında otomatik olarak tv simgesine geri dönen akıllı fallback mekanizması eklendi. / Replaced the tv icon next to channel names in video cards with circular, dynamic channel avatars served locally, falling back automatically to the TV icon if loading fails.

### Düzeltilen Hatalar / Fixed Bugs
- **İndirilmemiş Videolarda Silme Butonunun Gizlenmesi / Hiding Trash Icon on Undownloaded Videos:** Kütüphane sekmesinde indirilmemiş (tamamlanmamış) videoların üzerinde yer alan gereksiz çöp kutusu (silme) butonu gizlendi. Silme butonu artık yalnızca indirilmiş/tamamlanmış videolar için gösterilmektedir. / Hidden the unnecessary trash can (delete) icon for undownloaded videos in the Library tab. The delete button is now only shown for completed downloads.
- **Gömülü Oynatıcı Başlığının Korunması / Preserving Embedded Player Title:** Video oynatılırken filtreler arasında gezildiğinde veya dil güncellendiğinde, oynatıcı modalının başlığındaki video adının sıfırlanarak "Gömülü Video Oynatıcı" yazması engellendi. / Fixed a bug where switching library filters or updating language while a video is playing would reset the embedded player modal's title from the active video name back to generic "Embedded Video Player".


## [4.14.0] - 2026-06-05

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Kompakt Ayarlar Tasarımı / Compact Settings Layout:** Ayarlar sayfası dikey ve yatay boşlukları, form kontrollerinin paddingleri daraltılarak 2 sütunlu şık ve kompakt bir grid düzenine kavuşturuldu. / Redesigned the settings page into a clean, compact 2-column grid layout, reducing padding, margins, and form control sizes to fit nicely on a single screen page.
- **Kütüphane Filtrelemesi & Feed Temizliği / Library Filtering & Feed Cleanup:** Kütüphane geçmişinde ("Library" tab) sadece takip edilen kanalların videolarının gösterilmesi sağlandı. PD veya tekil link yapıştırma yoluyla indirilen takip dışı kanal videoları ise sadece "İndirilenler" (Downloaded) sekmesinde görünecek, böylece kütüphane geçmişinin şişmesi önlenecektir. / Filtered the Library feed to only display videos belonging to followed channels. Videos downloaded from untracked channels (via PD or direct links) are now displayed exclusively in the "Downloaded" tab to prevent Library feed bloat.
- **Plyr Player Mor Tema Rengi / Purple Plyr Theme Color:** Gömülü video oynatıcı (Plyr) kontrollerindeki ses seviyesi ve video ilerleme durum çubuğu rengi, uygulamanın ana mor rengine (`var(--primary)`) uyarlandı. / Overrode the default blue color of the Plyr player progress and volume bars to match the app's primary purple theme color.

### Düzeltilen Hatalar / Fixed Bugs
- **FFmpeg Otomatik Kurulum Kararlılığı / FFmpeg Auto Extraction Stability:** FFmpeg arşivden çıkarma sürecinde `tar` komutunun hata ve kapatma olaylarının çakışarak Powershell fallback sürecini çift tetiklemesi giderildi. Powershell hata kısıtlamaları güçlendirildi ve indirilen ZIP dosyaları için asgari boyut denetimi eklendi. / Fixed multiple subprocess triggers and promise race conditions caused by overlapping `tar` error and close events during extraction. Enhanced PowerShell error-action boundary checks and implemented zip file size verification.
- **Backend Exe Otomatik Kapatılması / Backend Process Auto-Termination:** Standart girdi (`stdin`) üzerinde `close` ve `end` olayları dinlenerek ana Tray uygulaması kapatıldığında `HaYTool-Backend.exe` sürecinin arkada yetim (orphaned) kalarak açık kalması önlendi. / Added stdin close and end listeners to automatically shut down the `HaYTool-Backend.exe` subprocess when the parent Tray wrapper application is closed.

## [4.13.3] - 2026-06-05

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Canlı Yayın Erteleme / Live Stream Postponing:** Aktif canlı yayınların yayın devam ederken indirilmeye çalışılması engellendi. Durumları kütüphanede `live` olarak işaretlenir ve periyodik RSS kontrollerinde yayın bittiği (normal video süresi aldığı) algılandığında otomatik olarak kuyruğa alınır. / Prevented downloading active live streams while they are still running. Their status is marked as `live` in the library, and once the stream ends (acquiring a normal duration) during periodic RSS checks, they are automatically queued for download.
- **configwin.ini İki Dilli Açıklamaları / Bilingual Comments in configwin.ini:** Yapılandırma dosyasındaki her ayarın üzerine ne işe yaradığını ve seçeneklerini açıklayan Türkçe ve İngilizce yorum satırları (#) eklendi. / Added bilingual (TR/EN) comment lines (#) explaining the function and valid options of each setting in the configuration file.
- **CLI ve Konsol Komut Sadeleştirmesi / CLI and Stdin Command Simplification:** Terminal ve Tray konsol komutları sadeleştirilerek tekilleştirildi ve çıktıları tamamen İngilizce yapıldı. Komutlar: `ton` (alternatif hız etkin), `toff` (alternatif hız pasif), `status` (sistem durumu), `pd <link>` (panodan/linkten indir) ve `clear` (konsolu temizle). / Simplified terminal and tray console commands, eliminating redundant aliases, and fully localized logs/outputs to English. Supported commands: `ton`, `toff`, `status`, `pd <link>`, and `clear`.
- **Tray.cs ComboBox Güncellemesi / Tray.cs ComboBox Sync:** C# Tray uygulamasındaki konsol komut listesi yeni sadeleştirilmiş CLI komutları ile senkronize edildi. / Aligned the predefined commands list dropdown inside the C# Tray console window with the new simplified CLI layout.

## [4.13.2] - 2026-06-04

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Çoklu Dil Port Çakışması Uyarısı / Multi-language Port Conflict Warning:** Port dolu olduğunda (`EADDRINUSE`) C# Tray uygulaması, veritabanından güncel dil seçimini okuyarak kullanıcının dilinde (`tr`, `en`, `es`, `de`, `pt`, `ru`, `ar`) net bir uyarı ekranı (`MessageBox`) göstermekte ve uygulamayı güvenle sonlandırmaktadır. / If the port is in use, the C# Tray application reads the active language setting to display a localized warning popup (`MessageBox`) and exits safely.
- **Dil Dropdown Seçeneklerinin Alfabetik Sıralanması / Alphabetical Language Dropdown Sorting:** Ayarlar sayfasındaki dil seçimi dropdown listesindeki diller, visual olarak göründükleri isimlerine göre dinamik olarak alfabetik sırada sıralanmaktadır. / The options in the language selector dropdown inside settings are now sorted alphabetically by their display text on page load.
- **Güncellenmiş Varsayılan Uygulama Ayarları / Updated Default Application Settings:** Sıfır kurulumda veya eksik yapılandırma dosyalarında, uygulamanın otomatik oluşturacağı ayarlar kullanıcının güncel ayarlarıyla (Varsayılan port 4141, RSS limiti 15, alternatif hız limiti 501, kontrol sıklığı 5 saniye vb.) eşitlendi. Ancak her sistemde çalışabilmesi için varsayılan indirme klasörü uygulama içi `download` olarak belirlendi. / The default application settings used on fresh installations or when config files are missing are now aligned with the user's settings (port 4141, RSS limit 15, check interval 5s, alternate speed limit 501, etc.), while keeping the default download path to a system-safe `"download"` folder relative to the workspace.

## [4.13.1] - 2026-06-04

### Düzeltilen Hatalar / Fixed Bugs
- **RSS Video ve Yayın Kaybolma Çözümü / RSS Video and Stream Missing Fix:** `yt-dlp` aracının flat-playlist modunda video/yayın tarihlerini boş döndürmesinden kaynaklanan, bu nedenle videoların ve canlı yayınların hatalı sıralanıp denetleme limiti (`rssLimit`) dışında kalarak kütüphanede gözükmemesi hatası giderildi. Artık ilk önce kanalın XML RSS akışındaki tarihler çekilerek `yt-dlp` çıktılarıyla eşleştirilmekte ve doğru tarih sıralamasıyla limit dahilinde taranmaktadır. / Fixed video and live stream missing/omission issues on watchlists caused by `yt-dlp` flat-playlist mode returning empty timestamps. The backend now fetches XML RSS feed dates first to map and sort combined videos and stream entries chronologically before applying limits.

## [4.13.0] - 2026-06-04

### Yeni Özellikler / New Features
- **Canlı Yayın Geçmişleri / Completed Live Streams:** yt-dlp taramalarına `/streams` sekmesi eklenerek tamamlanmış canlı yayın geçmişlerinin otomatik taranması ve indirilmesi sağlandı. / Added support for completed live streams by scanning both `/videos` and `/streams` tabs in yt-dlp.
- **Kanal Shorts Sınır Seçenekleri / Channel Shorts Limit Options:** Kanallara özel Shorts süre limiti seçenekleri 2/3/4/5/10/15 dakika gibi geniş bir yelpazeye çıkarıldı. / Expanded per-channel Shorts duration limits with options for 2, 3, 4, 5, 10, and 15 minutes.
- **Genişletilmiş Ayarlar Arayüzü / Responsive Settings Page:** Ayarlar tabı genişletilerek sağ taraftaki boşluk kaldırıldı ve alan tam ekran verimliliğiyle kullanıldı. / Widen settings page to fit container width, removing empty right side layout space.
- **Windows Bildirim Simge Desteği / Notification Custom Icon:** Video tamamlama bildirimlerine jenerik Windows simgesi yerine uygulamanın kendi simgesi (`icon.ico`) yerleştirildi. / Custom `icon.ico` is now loaded on native Windows toast balloon notifications.
- **Arka Plan Kanal Tarama / Background Sync:** "Şimdi Kanalları Yenile" butonu arka planda asenkron çalışacak şekilde güncellendi, böylece arayüzün donması engellendi. / The channel check sync route runs asynchronously in the background to prevent page hangs.

### Düzeltilen Hatalar & Temizlik / Fixed Bugs & Cleanups
- **Mind Vorteks & Geo-block Çözümü:** Bölgesel engelli kanalların eklenmesi ve taranmasındaki geo-block hataları, RSS XML yedek akışından gerçek kanal adını çözebilen fallback mekanizması ve hata izolasyonuyla kalıcı olarak çözüldü. / Fixed geo-blocking issues on restricted channels by introducing automatic fallback name resolution via RSS feed XML and isolating first-start scans.
- **Ölü Kod Temizliği / Dead Code Removal:** Arayüzde kullanılmayan eski global Shorts limit değişkenleri ve ayarlar yan menü CSS kuralları temizlenerek kod kalitesi optimize edildi. / Removed unused global Shorts limit logic and settings tab sidebar style properties.

---

## [4.12.1] - 2026-06-04

### Düzeltilen Hatalar / Fixed Bugs
- **İndirme Klasörü Seçimi / Folder Selection:** Windows PowerShell `-STA` (Single Threaded Apartment) uyumsuzluğu giderildi; "Klasör Seç" butonu artık çökmeden veya "Bağlantı Hatası" vermeden sorunsuz çalışıyor. / Fixed `.NET` `FolderBrowserDialog` crash in background Node.js process by forcing powershell `-STA` parameter.
- **Varsayılan Çerez Tercihi / Default Cookie Preference:** "Google Chrome" olan varsayılan çerez tercihi "Çerez Kullanma (none)" olarak değiştirildi ve mevcut kullancılar için otomatik olarak taşındı. / Default cookie option updated to "none" instead of "chrome" and automatically migrated for existing users.

---

## [4.12.0] - 2026-06-04

### Düzeltilen Hatalar / Fixed Bugs
- **CLI Sözdizimi Hatası Giderildi (SyntaxError: missing ) after argument list):** `server.js` satır 1157'deki `else` bloğunda, bilinmeyen bir komut girildiğinde gösterilen yardım metni yanlışlıkla `console.log(`` template literal'inin başlangıç karakteri atlanmış şekilde yazılmıştı. Bu durum Node.js'in `turtleon / turtleac / turtle-on` ifadesini aritmetik bölme/çıkarma işlemi olarak yorumlamasına yol açıyor ve uygulama hiç başlamıyor olmasına neden oluyordu. Template literal açılış backtick'i eklendi, CLI yardım metni tüm komutları kapsayacak şekilde genişletildi.
- **Fixed CLI SyntaxError (missing ) after argument list):** In `server.js` at line 1157, the help text displayed when an unknown command was entered inside the `else` block was mistakenly written without the opening backtick of a `console.log(\`` template literal. This caused Node.js to interpret `turtleon / turtleac / turtle-on` as arithmetic division/subtraction, crashing on startup before any server functionality could run. The opening backtick has been added and the CLI help text expanded to list all supported commands.

---

## [4.11.0] - 2026-06-03


### Yeni Özellikler & İyileştirmeler
- **HaYTooL YouTube Downloader Yeniden Markalama:** Uygulama adı tüm platformlarda, README'de ve dökümantasyonlarda "HaYTooL YouTube Downloader" olarak güncellendi.
- **Dosya ve Klasör Yapısı Düzenlemesi:** `yt-dlp` executable ve jenerik unix sürümleri dağınıklığı önlemek adına bağımsız `yt-dlp/` klasörüne taşındı. `ffmpeg` klasöründeki gereksiz `ffplay.exe` ve lisans/dokümantasyon dosyaları temizlenerek büyük oranda alan tasarrufu sağlandı.
- **Genişletilmiş Dil Desteği (Localization):** Mevcut dillere İspanyolca (`es`), Almanca (`de`), Portekizce (`pt`) ve Arapça (`ar`) dil paketleri eklendi. Dil menüsüne ülke bayrakları entegre edildi. İngilizce dilindeki bağlantı durumu ("Connection: Active") dil hatası giderildi.
- **Dinamik Sağ Tık Dil Senkronizasyonu:** Sistem tepsisi veya Windows sağ tık menüsündeki tetikleyiciler, uygulama içi dil değiştirildiğinde anlık olarak seçilen dille senkronize edilmektedir (yeniden başlatma gerektirmez).
- **Kanal Başına Geçmiş Videosu Sınırı:** Kütüphane arayüzünün ve veri tabanı bağlantılarının performansını artırmak amacıyla Ayarlar sayfasına "Kanal Başına" listeleme limiti (20, 50, 100 vb.) seçeneği getirildi.
- **Yedekleme ve Veri Yönetimi (Import/Export):** Takip edilen kanalların listesi artık standart JSON formatında (`channels_backup.json`) dışarı aktarılabilecek veya üzerine yazma/ekleme seçenekleriyle geri yüklenebilecek.
- **Log Sistemi Optimizasyonu:** `logs` klasöründeki dosya kalabalığı giderilerek tekil log dosyasına (`YYYY-MM-DD_HH-mm-ss.log`) düşürüldü. İnteraktif terminal konsolu arayüzündeki zaman damgası damgaları temizlenerek daha sade ve okunabilir konsol akışı sağlandı.
- **Yeni İkon ve Temizlik:** Projedeki eski `logo.ico` dosyası tamamen silindi, yeni tasarım `icon.ico` ana ikon olarak gömüldü ve C# tray wrapper `HaYTooL YT Downloader.exe` olarak derlendi.

---

## [4.10.0] - 2026-06-02

### Yeni Özellikler & İyileştirmeler
- **Taşınabilir Backend Motoru Entegrasyonu:** Sunucu ve CLI eylemleri artık sistemin jenerik `node` kurulumu yerine `bin\haytool-backend.exe` olarak özelleştirilmiş, gizli pencere modunda (`WindowStyle.Hidden`) çalışan standalone backend motoru üzerinden yürütülmektedir.
- **Sistem Başlangıcında Çalıştır (Start on Boot):** Tepsi sağ tık menüsüne Windows Registry (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`) ile entegre çalışan başlangıç ayarı eklendi. Varsayılan olarak kapalıdır.
- **Zaman/Tarih Gösterimi Karakter Sınırı Optimizasyonu:** Video kartlarında geçen gün sayısı gösterimleri Türkçe'de (Bugün, Dün, Xg) ve İngilizce'de (Today, Yest., Xd) formatlarında en fazla 3-5 karakteri kesinlikle aşmayacak şekilde optimize edildi.
- **Tam İngilizce Dil Yerelleştirmesi:** Ayarlar sayfasında Türkçe kalan tüm `<small>` açıklamaları, select `<option>` seçenekleri ve CLI bilgi kutusu dile göre tamamen dinamikleştirildi.
- **GitHub Link Entegrasyonu:** Üst panel ve Ayarlar sayfasındaki versiyon numarası (`v4.10.0`) tıklanabilir link haline getirilerek projenin resmi GitHub sayfasına bağlandı.

---

## [4.9.0] - 2026-06-02

### Yeni Özellikler & İyileştirmeler
- **Paste & Download Sekme Otomasyonu:** Üst paneldeki "PD" butonuyla veya C# tepsi sağ tık menüsündeki "Panodan İndir (Paste & Download)" seçeneğiyle indirme başlatıldığında, tarayıcının otomatik olarak "Kuyruk" sekmesine geçmesi sağlandı. Tarayıcı zaten açıksa, SSE (`switch_tab` olayı) üzerinden sayfa yenilenmeden geçiş tetiklenir.
- **Video Kartlarında Yüklenme Zamanı Bilgisi:** İndirilen/geçmişteki videoların altındaki boşluğa, videonun kaç gün önce yüklendiği bilgisi ("Bugün", "Dün", "X gün önce") eklendi. Dil seçeneğine bağlı olarak İngilizce dilinde de otomatik biçimlendirilir.
- **RTX Spark Log Temizliği & Çözümleme Düzeltmesi:** Loglarda sürekli `Eksik bilgiler çözümleniyor` mesajı basarak log kirliliğine neden olan yayın tarihi (`publishedAt`) çözümlenememe hatası düzeltildi. Süresi veya yayın tarihi çözümlenemeyen videolara 3 başarısız deneme sınırı konulup, tarih `'-'` yapılarak döngü durdurulmaktadır.
- **hayto pd CLI Desteği:** `hayto.bat` veya `hayto.ps1` aracılığıyla `hayto pd <link>` komutuyla kolayca indirme başlatma desteği sağlandı.

---

## [4.8.1] - 2026-06-02

### Düzeltilen Hatalar & İyileştirmeler
- **CLI Çıktı Karakter Kodlaması (UTF-8):** `HaYTool.exe` CLI arayüzünün çıktı yönlendirmesi UTF-8 olarak güncellendi. Bu sayede `[SİSTEM] Durum` çıktısındaki `SĞ-STEM` veya `S-STEM` gibi Türkçe karakter bozulmaları giderildi.
- **CLI İstemi Geri Dönüşü (Prompt Release):** Windows terminalinde `HaYTool.exe` CLI komutu girildikten sonra komut satırının takılı kalması ve Enter tuşuna basma gereksinimi giderildi. Program sonlandığında `FreeConsole()` ile konsoldan ayrılma ve Win32 `keybd_event` ile otomatik `ENTER` tuşu simülasyonu tetiklenerek kontrol terminale anında devredilmektedir.
- **Kılavuz Düzenlemeleri:** `README.md` dosyasındaki CLI komut örnekleri, `haytool status`, `haytool speed 2500` gibi tam ve yazılabilir komut formatında baştan aşağı düzenlendi.

---

## [4.8.0] - 2026-05-30

### Yeni Özellikler
- **Alternatif Hız Sınırı (Turtle Mode):** qBittorrent benzeri iki farklı hız profili desteği eklendi. Normal indirme hızı ve kaplumbağa simgesi ile gösterilen alternatif hız limiti bağımsız olarak kontrol edilebilmektedir.
- **Ayarlar Sayfası Debounceli Otomatik Kaydetme:** Manuel kaydet butonu kaldırılarak, yapılan tüm ayar değişikliklerinin 500ms debounce ile anlık asenkron kaydedilmesi sağlandı.
- **Sistem Tepsisi Sekme Kısayolları:** Tepsi menüsüne doğrudan Kütüphane, İndirme Sırası, İndirilenler, Kanallar ve Ayarlar sekmelerine geçiş sağlayan kısayollar eklendi.
- **İnteraktif Konsol Paneli:** Sistem tepsisi konsol penceresine stdin üzerinden sunucuya komut gönderme paneli entegre edildi.
- **Sistem Tepsisi Alternatif Hız Toggle:** Sistem tepsisi sağ tık menüsüne hız sınırını değiştiren işaretlenebilir buton eklendi.

### Optimizasyonlar & Temizlik
- **Log Otomatik Temizliği:** Sunucu her başladığında 7 günden eski günlük `.log` dosyalarını otomatik olarak temizleyen temizlik işleyicisi entegre edildi.
- **Görsel Varlıkların Güncellenmesi:** Uygulama logosu ve sistem tepsisi simgesi yeni tasarımlarla güncellendi. Artık kullanılmayan `Baslat.bat` temizlendi.
- **CLI Desteği:** `HaYTool.exe` ve `server.js` üzerinden terminal yardımıyla anlık durum kontrolü ve limit ataması özelliği eklendi.

### v9.8.10
- Linux AppImage sürümünde veritabanı ve ayar dosyalarının çalışma dizini yerine XDG standartlarına uygun şekilde `~/.config/HaYTooL-YT-Downloader` dizinine kaydedilmesi sağlandı.


### v9.8.11
- AppImageUpdate (zsync) desteği eklenerek Linux üzerinde CachyOS ve diğer araçlarla güncelleme entegrasyonu sağlandı.


### v9.8.12
- Test için sürüm güncellendi.


### v9.8.13
- AppImage üzerinde read-only (EROFS) hatalarına yol açan 'iptv_cache.json', 'backup' ve 'cookies.txt' yolları '.config' dizinine yönlendirildi.
- Linux masaüstü başlatıcı (.desktop) kategorisi 'AudioVideo' (Multimedya) olarak kısıtlandı.


### v9.8.14
- Linux AppImage başlatıldığında arka plandaki konsol penceresi gizlendi (Terminal=false).
- Linux sistemlerinde tarayıcılar (Chrome/Brave/Edge) otomatik tespit edilip uygulamanın bağımsız bir pencerede (App Mode) çalışması sağlandı.

