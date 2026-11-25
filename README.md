# Filiz — kişisel dil öğrenme uygulaması (PWA)

Filiz; kısa dersler, aralıklı tekrar (FSRS), her dilde en sık kullanılan ~3200 kelime, "Sesler ve Harfler"
başlangıç bölümü, kariyer hedefi ve yol haritası, sektör terimleri (tekstil öncelikli) ve telefonu arkadaşına
verebileceğin bir **Demo Modu** içeren bir web uygulamasıdır (PWA). iPhone ve iPad'de Safari'den ana ekrana eklenip
uygulama gibi kullanılır. Mac gerekmez.

**Canlı adres:** https://burakemirk.github.io/filiz/

> Kelime paketleri açık kaynaklardan (wordfreq, Vikisözlük, Tatoeba, Wikimedia Commons) **otomatik** üretildi;
> elle hazırlanan başlangıç dersleri, tekstil terimleri ve Sesler ve Harfler ise yapay zekâ taslağıdır.
> Hiçbiri **uzman doğrulamasından geçmemiştir**.

---

## 1. iPhone / iPad'e kurulum

1. **Safari**'de https://burakemirk.github.io/filiz/ adresini aç (gizli sekme değil).
2. **Paylaş** (kare + yukarı ok; görünmüyorsa **•••** → Paylaş) → **Ana Ekrana Ekle**.
3. **Web Uygulaması Olarak Aç** açık kalsın → **Ekle**.
4. Uygulamayı her zaman **ana ekrandaki simgeden** aç. Safari sekmesi ile ana ekran uygulaması verilerini paylaşmaz.

iPad'de Apple Pencil ile yazı için: **Ayarlar → Apple Pencil → Karalama** açık; **Ayarlar → Genel → Klavye →
Klavyeler** bölümünden Rusça (ve diğer diller) klavyesi ekli olmalı. Macarca Scribble'da desteklenmiyor.

Ses çıkmazsa uygulamada **Profil → Yardım → Ses testi** ekranını aç ve raporu kopyala.

## 2. Bilgisayarda çalıştırma (Windows)

Gerekenler: [Node.js](https://nodejs.org/) 24 veya üstü.

```bash
npm install
```

```bash
npm run dev
```

Sonra tarayıcıda `http://localhost:5173` adresini aç. Aynı Wi-Fi'deki telefondan denemek için `npm run dev:lan`
(adres `https` olmadığı için çevrimdışı önbellek ve mikrofon bu yolla çalışmaz).

## 3. Yayın: GitHub Pages

Her `main` dalına gönderimde [.github/workflows/deploy.yml](.github/workflows/deploy.yml) tip denetimi, testler ve
derleme yapar, sonra siteyi yayınlar. **Testlerden biri bile başarısız olursa yayın yapılmaz.**

- Ücretsiz GitHub planında Pages için depo herkese açıktır; öğrenme verilerin depoya hiç girmez, telefonunda kalır.
- Verilerin uygulamanın **adresine** bağlı saklanır. Depo veya kullanıcı adı değişirse eski ilerleme yeni adreste
  görünmez; değiştirmeden önce **Profil → Yedekleme ve geri yükleme → Yedek al**.

## 4. Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run dev:lan` | Geliştirme sunucusu (yerel ağdaki telefon/tablet de erişebilir) |
| `npm test` | Kabul ve içerik testleri |
| `npm run typecheck` | TypeScript tip denetimi |
| `npm run build` | Yayınlanacak sürümü `dist/` klasörüne üretir |
| `npm run icons` | Uygulama simgelerini yeniden üretir |

## 5. Neler var, durumları

| Özellik | Durum |
|---|---|
| Üç bölüm: Bugün (tek düğmeyle günlük çalışma) / Keşfet (dersler, sesler, sektör, kelimeler, ek pratik) / Profil; iPhone alt sekme, iPad kenar çubuğu | Çalışıyor (tarayıcıda denendi) |
| Günlük oturum: 8–12 adım, yarım kalırsa kaldığı yerden; yeni kelime = tanıt + tanıma; yazma ve boşluk doldurma tekrarlarda; günlük yeni kelime hedefi (bugün ilk kez tanışılanlar sayılır) | Çalışıyor (testli, tarayıcıda denendi) |
| Her dilde en sık ~3200 kelime, 5'er kelimelik dersler, 50'şer kelimelik birimler, birim atlama kontrolü | Çalışıyor (testli) |
| Sesler ve Harfler (6 dil); Rusçada iPad'de kalemle harf yazma alanı | Çalışıyor; kalem **iPad'de test edilmedi** |
| Kariyer hedefi: kilometre taşları, gerçek çalışma hızına göre tahmini bitiş | Çalışıyor (testli) |
| FSRS aralıklı tekrar, beceri bazlı; Günün Kelimesi; yeni öğe sayısının tekrar yüküne göre azalması | Çalışıyor (testli) |
| Hata defteri, kişisel ifade koleksiyonu, yedek al / yükle | Çalışıyor |
| Demo Modu (ayrı veritabanı; Profil → Yardım; çıkışta "Telefonu sahibine ver" ekranı) | Çalışıyor (testli, tarayıcıda denendi) |
| İnsan sesi kayıtları (Wikimedia), cihaz sesi yedeği, Ses testi ekranı | **iPhone'da test edilmedi** |
| Tekstil terimleri (İngilizce, Rusça) | Örnek içerik |
| Dilbilgisi / görev anlamı / doğallık için çevrimiçi değerlendirme | Bağlı değil: cümleler "pratik cümlesi" olarak kaydedilir |
| iPhone–iPad otomatik senkron, konuşma kaydı, haftalık kalıcılık kontrolü, gerçek hayat görevleri, diğer sektörlerin terimleri | Sonraki aşama |

Arayüz ve kullanılabilirlik kuralları: [.claude/skills/filiz-usability/SKILL.md](.claude/skills/filiz-usability/SKILL.md).
İlk 100 kelime içerik denetimi: [docs/content-review-2026-11-20.md](docs/content-review-2026-11-20.md).

## 6. Kelime paketleri

`public/content/<dil>/` altındaki paketler `scripts/content/build_content.py` ile üretilir. Kaynaklar ve lisanslar:
[public/content/SOURCES.md](public/content/SOURCES.md). Paketler CC BY-SA 4.0 lisanslıdır.

Yöntem kısaca: wordfreq sıklık listesindeki biçimler Vikisözlük'ün çekim bilgisiyle sözlük biçimlerine
birleştirilir ("воду, воды" → "вода"), kısaltma/eski yazım ilişkileri sayılmaz, ilk anlamı küfür/hakaret olan
kelimeler alınmaz. Kelimenin biçim listesine eski yazımlar, ağız biçimleri, yazım hataları, kısaltmalar, Roma rakamları
ve "alternative form" girişleri alınmaz (ör. "one" için "I", "my" için "me"); standart çeşitler
(`scripts/content/overrides.py`, `KEEP_FORMS`) korunur. Elle yapılan düzeltmeler `scripts/content/corrections.json`
dosyasındadır ve her yeniden üretimde uygulanır. Türkçe anlam sırasıyla Türkçe Vikisözlük, İngilizce Vikisözlük çeviri tablosu, İngilizce
üzerinden eşleşme ve son çare makine çevirisinden gelir; kaynağı her kelimede gösterilir.

Paketleri yeniden üretmek için (yaklaşık 3,4 GB veri indirilir, işleme ~10 dk):
1. `data-raw/` altına kaikki.org İngilizce ve Türkçe Vikisözlük verisini, Tatoeba dil dosyalarını, emojibase
   dosyalarını ve Argos İngilizce→Türkçe modelini indir (adresler betiğin başında ve SOURCES.md'de).
2. Kısa bir yolda Python ortamı kur: `python -m venv <kısa-yol>` ve `pip install wordfreq ctranslate2 sentencepiece`.
3. `PYTHONUTF8=1 <kısa-yol>/Scripts/python scripts/content/build_content.py`

## 7. Proje yapısı

```
src/
  content/        İçerik: diller, sektörler, kavramlar, elle hazırlanmış paketler, Sesler ve Harfler,
                  büyük kelime paketlerinin yükleyicisi (generated.ts) ve kayıt defteri (registry.ts)
  domain/         İş kuralları: FSRS planlayıcı, değerlendirme, kariyer, metin karşılaştırma, servisler
  data/           IndexedDB veritabanı, depo, sahip/misafir oturum yöneticisi
  screens/        Ekranlar ve alıştırma oynatıcısı
  ui/             Ortak bileşenler, ses, kalemle yazma alanı, illüstrasyonlar
public/content/   Üretilmiş kelime paketleri (dil başına, ilk kullanımda iner, çevrimdışı saklanır)
scripts/          Simge üretici ve içerik hattı (scripts/content/build_content.py)
tests/            Kabul ve içerik testleri
```

## 8. Bilinen sınırlar

- Uzman doğrulaması yok. Türkçe anlamların bir kısmı makine çevirisidir ve öyle etiketlenir.
- Sıklık sırası CEFR seviyesi değildir. Macarca ve Türkçe sıklık listeleri daha az kaynağa dayanır.
- İnsan sesi kapsamı dile göre değişir; İspanyolcada neredeyse hiç kayıt bulunamadı (cihaz sesi kullanılır).
- İnsan sesleri ilk çalmada Wikimedia sunucularından iner (telefonun IP adresi Wikimedia'ya gider), sonra cihazda saklanır.
- Çevrimiçi cümle değerlendirmesi yok; dilbilgisi ve doğallık "bekliyor" kalır.
- iOS'un web uygulaması verisini hiç silmeyeceği garanti değildir; düzenli yedek al.

## 9. Kullanılan açık kaynak

- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) (MIT), [Dexie](https://dexie.org/) (Apache-2.0), React, Vite, vite-plugin-pwa
- Veri: wordfreq, Wiktextract/kaikki.org (Vikisözlük), Tatoeba, Wikimedia Commons / Lingua Libre, emojibase, Argos Translate — ayrıntılar SOURCES.md
