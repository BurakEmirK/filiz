# Filiz — kişisel dil öğrenme uygulaması (Aşama 1, PWA)

Filiz; kısa dersler, aralıklı tekrar (FSRS), kendi cümleni kurma, sektör terimleri (tekstil öncelikli) ve
telefonu arkadaşına verebileceğin bir **Demo Modu** içeren bir web uygulamasıdır (PWA). iPhone ve iPad'de
Safari'den ana ekrana eklenip uygulama gibi kullanılır. Mac gerekmez.

> Bu Aşama 1'dir. Her dilde küçük **örnek içerik** vardır (tam müfredat değildir) ve içeriklerin tamamı
> **yapay zekâ taslağıdır, uzman doğrulamasından geçmemiştir**.

---

## 1. Bilgisayarda çalıştırma (Windows)

Gerekenler: [Node.js](https://nodejs.org/) 24 veya üstü (bu proje Node 24.19 ile denendi).

```bash
npm install
```

```bash
npm run dev
```

Sonra tarayıcıda `http://localhost:5173` adresini aç.

## 2. iPhone / iPad'de hızlı deneme (aynı Wi-Fi, barındırma olmadan)

```bash
npm run dev:lan
```

Komut çıktısındaki `Network: http://192.168.x.x:5173` adresini iPhone/iPad Safari'de aç. Windows güvenlik
duvarı izin isterse "Özel ağ" için izin ver.

**Bu yolun sınırları:** Adres `https` olmadığı için çevrimdışı önbellek (service worker) ve mikrofon çalışmaz.
Arayüzü, dersleri, Scribble ile el yazısını ve Demo Modu'nu denemek için yeterlidir.

## 3. Gerçek kurulum: GitHub Pages (ücretsiz, HTTPS)

Uygulama GitHub Pages'te yayınlanır: `https://KULLANICI-ADIN.github.io/filiz/`. Her `main` dalına gönderimde
[.github/workflows/deploy.yml](.github/workflows/deploy.yml) sırasıyla tip denetimi, testler ve derleme yapar,
sonra siteyi yayınlar. **Testlerden biri bile başarısız olursa yayın yapılmaz.**

Bir kerelik ayar: depo → **Settings** → **Pages** → *Build and deployment* → **Source: GitHub Actions**.

Notlar:
- Ücretsiz GitHub planında Pages için depo **herkese açık** olmalıdır: uygulamanın kodu herkese görünür.
  Senin öğrenme verilerin (ilerleme, cümlelerin, koleksiyonun) depoya hiç girmez; telefonunda kalır.
- Verilerin uygulamanın **adresine** bağlı saklanır. Depo adını veya kullanıcı adını değiştirirsen adres değişir
  ve eski adresteki ilerleme yeni adreste görünmez. Değiştirmeden önce **Ben → Verilerin → Yedek al**.
- Derleme çıktısı yerelde de alınabilir: `npm run build` → `dist/` klasörü.

iPhone/iPad'e kurulum: Safari'de adresi aç → **Paylaş** → **Ana Ekrana Ekle**. (iOS 26'da "Web Uygulaması
Olarak Aç" varsayılan olarak açıktır.) Not: Safari'de açılan site ile ana ekran uygulaması **verilerini paylaşmaz**;
uygulamayı her zaman ana ekrandaki simgeden aç.

## 4. Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu (yalnızca bu bilgisayar) |
| `npm run dev:lan` | Geliştirme sunucusu (yerel ağdaki telefon/tablet de erişebilir) |
| `npm test` | Kabul testlerini çalıştırır (24 test) |
| `npm run typecheck` | TypeScript tip denetimi |
| `npm run build` | Yayınlanacak sürümü `dist/` klasörüne üretir |
| `npm run preview` | Üretilen sürümü yerelde dener |
| `npm run icons` | Uygulama simgelerini yeniden üretir |

## 5. Neler var, durumları

| Özellik | Durum |
|---|---|
| Bugün / Öğren / Sektörler / Kelimeler / Ben bölümleri, iPhone alt sekme + iPad kenar çubuğu | Çalışıyor (tarayıcıda denendi) |
| Dersler: tanıt → dinle/eşleştir → yaz → boşluk doldur → kendi cümleni kur → görev | Çalışıyor |
| FSRS aralıklı tekrar, beceri bazlı (metinde tanıma, seste anlama, yazma) | Çalışıyor (testli) |
| Günün Kelimesi + eski kelimelerle bağlantılı tekrar; yeni öğe sayısının tekrar yüküne göre azalması | Çalışıyor |
| Hata defteri (farklı örnekle pratik), kişisel ifade koleksiyonu | Çalışıyor (temel) |
| Demo Modu: ayrı veritabanı, çıkışta silme, uygulama kapanırsa kurtarma | Çalışıyor (testli + tarayıcıda denendi) |
| Yedek al / yedekten yükle (birleştirerek, çoğaltmadan) | Çalışıyor (testli) |
| 6 dilde kelimeler; İngilizce ve Rusça tekstil terimleri | **Örnek içerik** |
| Cümle değerlendirme: cihaz içi kontroller + "bekliyor" kuyruğu | Çalışıyor |
| Dilbilgisi / görev anlamı / doğallık için çevrimiçi değerlendirme | **Entegrasyon bekliyor** (Aşama 2) |
| El yazısı (Scribble) + tanınan metni düzeltme adımı | Mantık testli; **iPad'de test edilmedi** |
| Model ses (cihazın sentetik sesi) | **Cihazda test edilmedi** |
| Ana ekrana kurulum, çevrimdışı çalışma | Chromium'da önbellek doğrulandı; **iPhone/iPad'de test edilmedi** |
| iPhone–iPad otomatik senkron, konuşma kaydı, Pencil ile harf çizme, haftalık kalıcılık kontrolü, gerçek hayat görevleri, diğer sektörlerin içeriği | **Aşama 2** |

## 6. Cihaz test listesi (senin yapman gerekenler)

Bunları ben bu ortamda doğrulayamam; iPhone 15 Pro ve iPad Air'de dene ve sonucu bana yaz:

1. Ana ekrana ekle → uygulama tam ekran açılıyor mu, simge doğru mu?
2. İlk kurulumu bitir, bir ders yap, uygulamayı kapat (uygulama değiştiricide yukarı kaydır), tekrar aç: ilerleme duruyor mu?
3. Uçak modunu aç → uygulama açılıyor mu, ders yapılabiliyor mu? Serbest cümle "bekliyor" görünüyor mu?
4. Dinle düğmesi: Rusça, Macarca, Fransızca, İspanyolca, İngilizce, Türkçe için ses çıkıyor mu? Hangisinde "Ses yok" yazıyor?
5. iPad + Apple Pencil: "El yazısı" modunda kutuya yaz → metne çevriliyor mu? Rusça için iPad'de Rusça klavye ekli olmalı. Macarca'da (Scribble desteklemiyor) ne oluyor?
6. iPad'i yatay/dikey çevir, Split View'da Safari'nin yanında aç: düzen bozuluyor mu?
7. Ayarlar → Erişilebilirlik → Metin boyutunu büyüt; VoiceOver ile bir ders dene.
8. Demo Modu: başlat → arkadaş olarak birkaç adım yap → uygulamayı demo sırasında kapat → tekrar aç: kendi verilerin yerinde mi?
9. Yedek al → Dosyalar'a kaydet → diğer cihazda "Yedekten yükle".

## 7. Proje yapısı

```
src/
  content/        İçerik: diller, sektörler, kavramlar (görsel eşlemesi), dil paketleri
    packs/        ru.ts, en.ts, others.ts (hu, fr, es, tr) — yeni içerik buraya eklenir
  domain/         İş kuralları: planlayıcı (FSRS), değerlendirme, metin karşılaştırma, servisler
  data/           IndexedDB veritabanı, depo (repository), sahip/misafir oturum yöneticisi
  screens/        Ekranlar ve alıştırma oynatıcısı
  ui/             Ortak bileşenler, ikonlar, illüstrasyonlar, ses, cevap girişi
tests/            Kabul testleri (Node + sahte IndexedDB)
scripts/          Simge üretici
```

### Yeni içerik eklemek

- **Yeni kelime/anlam:** ilgili dil paketine (`src/content/packs/`) bir `word({...})` kaydı ekle; anlamın bir
  kavrama (`src/content/concepts.ts`) bağlanması gerekir. Görsel kavrama bağlıdır, böylece her görsel öğretilen anlamla eşleşir.
- **Aynı kelimenin ikinci anlamı:** `lexemeId` ile mevcut kelimeye bağla, `senseIndex: 2` ver ve **farklı** bir kavram kullan.
- **Yeni dil:** `src/content/languages.ts` içine bir kayıt + yeni paket + `registry.ts` içindeki `PACKS` listesine ekleme.
- **Yeni sektör:** `src/content/industries.ts` içine kayıt + dil paketlerinde `industry` alanlı anlamlar ve dersler.
- `npm test` içerik bütünlüğünü (görsel eşleşmesi, örnek cümleler, ders bağlantıları) otomatik denetler.

## 8. Bilinen sınırlar (dürüst liste)

- İçerik küçük ve yapay zekâ taslağıdır; uzman doğrulaması yoktur.
- Çevrimiçi cümle değerlendirmesi yok; dilbilgisi ve doğallık "bekliyor" kalır (bilerek: sahte başarı göstermemek için).
- Ses, cihazın sentetik konuşma sesidir; kalite ve dil desteği cihaza göre değişir. Telaffuz puanlaması yoktur.
- iOS'un web uygulaması verisini hiç silmeyeceği garanti değildir; düzenli yedek al.
- Arayüz yalnızca Türkçe; açıklama dili ayarı şimdilik kısa anlamlar için İngilizceyi destekler.
- "Kendiliğinden üretme" becerisi çevrimiçi değerlendirme gelene kadar tekrar planına alınmaz.

## 9. Kullanılan açık kaynak

- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) (MIT) — FSRS-7 tekrar planlayıcı
- [Dexie](https://dexie.org/) (Apache-2.0) — IndexedDB
- React, Vite, vite-plugin-pwa (Workbox)

Görseller bu proje için çizilmiş basit özgün SVG illüstrasyonlardır (`src/ui/illustrations.tsx`).
