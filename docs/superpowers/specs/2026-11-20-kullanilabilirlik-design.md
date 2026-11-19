# Kullanılabilirlik güncellemesi — tasarım (2026-11-20)

Kaynak: kullanıcının 2026-11-20 tarihli ayrıntılı isteği (10 bölüm). İstek; "planlamadan uygulamaya geç, rutin seçimlerde
makul varsayılanları kullan" dediği için ayrı onay beklenmeden uygulanır. Görsel ve kullanılabilirlik kuralları tek yerde
tutulur: `.claude/skills/filiz-usability/SKILL.md`. Bu belge kararları ve nedenlerini kaydeder.

## Amaç

Uygulama karmaşık geliyor. Hedef: her gün tek düğmeyle başlayan, 8–12 adımlık kısa, kaldığı yerden sürdürülebilen bir
çalışma; sade kelime kartları; dürüst cümle değerlendirme durumu; kısa bir Profil. Mevcut özellikler ve öğrenme kayıtları
korunur, ikincil özellikler silinmez, yer değiştirir.

Hedef dışı: ücretli API, çevrimiçi değerlendirici kurmak, iPhone–iPad senkronu, yeni içerik paketi üretmek.

## Kararlar

### Gezinme: üç bölüm
- **Bugün** `#/today` — önerilen günlük çalışma, kaldığı yerden devam, bitiş özeti.
- **Keşfet** `#/explore` — öğrenme yolu ve ders kütüphanesi (`#/learn`), Sesler ve Harfler (`#/sounds`), sektör
  (`#/industries`, `#/industries/<id>`), kelime arama ve koleksiyon (`#/words`), ek pratik (tekrar, hata defteri, Günün Kelimesi).
- **Profil** `#/profile` — kısa özet; alt sayfalar `#/profile/<bölüm>`.
- Eski adresler çalışmaya devam eder: `#/me` → Profil, `#/career` → Profil › Hedef, `#/sound-test` Profil altında.

### Günlük oturum
- Kalıcı kayıt: yeni `sessions` tablosu (Dexie şema sürümü 2; eski tablolar aynen korunur, yedek dosyası geriye uyumlu).
  Oturum, adımların **tanımını** (anlam kimliği, seçenek kimlikleri, tür) saklar; yeniden açılınca aynı sıra kurulur.
- İçerik sırası: (1) yarım kalmış oturum, (2) yarım kalmış ders, (3) yeni oturum: zamanı gelen tekrarlar + günlük
  bütçeden kalan yeni kelimeler. Günün Kelimesi, oturumun ilk yeni kelimesidir ve kartında öyle etiketlenir.
- Boyut (tasarım tercihi, bilimsel kural değil): oturum başına en çok 4 yeni kelime (tanıt + tanıma = 2 adım/kelime);
  kalan yer tekrara, toplam ~8–12 adım. Yanlış cevaplanan yeni kelime oturum sonunda bir kez daha sorulur (en çok 3).
- Yazma ve cümlede kullanma sonraya dağıtılır: tanıma becerisi en az 2 kez başarıyla tekrar edilmiş ve yazma kaydı
  olmayan kelimeler, tekrar oturumlarında "yaz" ya da "boşluk doldur" adımıyla tanışır (oturum başına en çok 2).
- Serbest cümle isteğe bağlıdır ve oturum bitiş ekranında önerilir.

### Günlük yeni kelime bütçesi
- "Bugün tanıştırılan yeni anlam" = tekrar kaydındaki **ilk** kaydı yerel gün içinde olan, benzersiz anlam kimlikleri.
  Harf/ses öğeleri (`snd:`), kişisel ifadeler (`user:`) ve "biliyorum" kontrolleri (`placement`) sayılmaz.
- Kalan = günlük hedef (tekrar yüküne göre azalabilir) − bugün tanıştırılan. Aynı anlam iki kez sayılmaz.
- Bütçe bitince "Bugünlük tamam" ve isteğe bağlı **Biraz daha çalış**: hedefin dışında yeni kelime ya da tekrar.

### Kısa dersler ve eski yarım dersler
- Ders (kütüphaneden açılınca) artık tanıt + tanıma: 5 kelimede ~10 adım. Yazma/boşluk/cümle tekrarlara dağıtılır.
- Ders kaydına `seq: 2` eklenir. `seq` alanı olmayan **yarım** ders eski uzun sırayla kaldığı adımdan sürer (ilgisiz
  adıma atlamaz, ilerleme silinmez, kendiliğinden "bitti" sayılmaz); ekranda bunu söyleyen kısa bir not çıkar.
- Günlük oturum bir dersin tüm kelimelerini tanıştırınca o ders "tamamlandı" olarak işaretlenir (kütüphane tutarlı kalır).

### Kelime kartı ve alıştırmalar
- Varsayılan kart: hedef dildeki yazılış (serif, büyük), belirgin "Dinle" düğmesi, tek anlam, tek kısa örnek, varsa görsel.
  Sözcük türü (ör. "fiil") görünür kalır.
- "Okunuş ve ayrıntılar" açılır bölümü: harf çevirisi, yaklaşık söyleyiş, IPA, İngilizce anlam ve kaynağı, diğer anlamlar,
  yakın anlamlılar, dilbilgisi, kaynak ve lisans, sıklık sırası, "Bu içerikte sorun var" bildirimi.
- Her alıştırma: tek satır yönerge, tek birincil eylem, kısa geri bildirim ("Doğru." / "Doğrusu: …"), "Neden?" açılır
  bölümünde ek açıklama.
- Aynı Türkçe anlamı taşıyan başka bir kelime **doğru sayılmaz**; "Bu da benzer anlamlı olabilir, ama burada istenen: …"
  denir (birbirinin yerine geçtikleri varsayılmaz).

### Cümle değerlendirme durumu
- Üç durum: `unconfigured` (sunucu adresi yok), `offline` (adres var, bağlantı yok), `ready`.
- `unconfigured`: yazmadan önce "Şu an cümle değerlendiren bir hizmet bağlı değil; cümlen pratik olarak kaydedilir"
  açıklaması, düğme "Pratik cümlesini kaydet", sonra "Cümlen kaydedildi." Kayıt `evalStatus: 'local'` olur
  (değerlendirme kuyruğuna girmez, "yakında" sözü verilmez). Dört eksenli ayrıntı varsayılan akışta gösterilmez.
- `offline`: "Bağlantı gelince değerlendirilecek" (kuyruk: `pending`). Mimari (Evaluator arayüzü) korunur.

### Profil
- Açılış: aktif diller, kısa ilerleme, hedef özeti, alt sayfa bağlantıları.
- Alt sayfalar: Öğrenme tercihleri (gelişmiş: hatırlama oranı), Görünüm ve erişilebilirlik, Yedekleme ve geri yükleme,
  Yardım (ses testi, Demo Modu, özellik durumu, içerik bildirimlerim), Kaynaklar ve lisanslar, Ayrıntılı ilerleme, Hedef.

### İçerik
- Ru/hu/en için ilk 100 kelime gözden geçirilir; açık hatalar `scripts/content/corrections.json` dosyasında kaydedilir ve
  paketlere uygulanır (kimlikler, kaynak ve lisans korunur; düzeltilen alana `curated` kaynağı yazılır). Emin olunamayanlar
  `docs/content-review-2026-11-20.md` dosyasında "gözden geçirilmeli" diye listelenir. Bu bir yapay zekâ incelemesidir,
  uzman doğrulaması değildir.
- İçerik bildirimi: kelime kartından ve geri bildirimden; yalnızca bu cihazdaki `reports` tablosunda saklanır, hiçbir
  yere gönderilmez; Profil › Yardım'da listelenir ve kopyalanabilir. Yedeğe dahildir.

### Veri ve Demo
- Yedek yüklendikten sonra profil yeniden okunur ve ekranlar yenilenir.
- Demo çıkışı: önce sahibin verisini göstermeyen bir "Telefonu sahibine ver" ekranı, sahibi "Kendi çalışmama dön"e basınca
  kaldığı yer açılır. Yeniden yükleme/kapanma sırasında mevcut kurtarma (misafir verisi silinir) korunur.

### Görsel kimlik
- Yeni varsayılan tema **Çivit** (çivit boyası: kumaşın klasik mavisi; uygulamanın tekstil bağlamı). Eski temalar seçilebilir.
  Eski varsayılan "Kum" kullanan profiller bir kez Çivit'e geçirilir (Görünüm'den geri alınabilir).
- Hedef dildeki kelimeler sistem serif yazı tipiyle (iPhone/iPad'de New York) sözlük madde başı gibi dizilir; arayüz
  sistem sans (SF Pro). Ek yazı tipi indirilmez, çevrimdışı çalışır, Dinamik Yazı ile büyür.
