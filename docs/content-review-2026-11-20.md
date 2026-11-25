# İçerik denetimi: ilk 100 kelime (Rusça, Macarca, İngilizce), 2026-11-20

> Bu bir **yapay zekâ (Claude) incelemesidir**, uzman dilbilimci doğrulaması değildir. Düzeltmeler açık hataları
> giderir; "emin değilim" listesi bir anadili konuşan ya da öğretmen tarafından kontrol edilmelidir.

Düzeltmelerin kaydı: [scripts/content/corrections.json](../scripts/content/corrections.json). Paketlere
`scripts/content/apply_corrections.py` ile uygulandı ve `build_content.py` her yeniden üretimde aynı düzeltmeleri uygular.
Kalıcı test: [tests/contentQuality.test.ts](../tests/contentQuality.test.ts).

## Kimlikler, kaynak ve lisans

- Anlam kimlikleri (`g:<dil>:<kelime>#1/#2/#3`) değişmedi. Yanlış bir ikincil anlam **silinmedi, gizlendi**
  (`"h": 1`); böylece diğer anlamların numarası kaymadı.
- Yeni örnek cümlelerin hepsi Tatoeba'dan alındı (CC BY 2.0 FR); kaynak kimliği (`tatoeba:<id>`) ve Tatoeba'daki insan
  çevirisi korundu.
- Yalnızca Türkçesi düzeltilen cümleler uygulamada "(çeviri düzeltildi)" diye etiketli.
- Düzeltilen anlamlar "elle düzeltildi" kaynağıyla etiketli.

## Önceki incelemenin iki bulgusu

| Bulgu | Durum |
|---|---|
| İngilizce "This is never going to end." → "Bu sonuna kadar asla gitmez." | Düzeltildi: "Bu asla bitmeyecek." Aynı cümle "this" ve sık kelime paketinin başka yerlerinde de kullanıldığı için hepsinde düzeldi. "be" kelimesine daha açık bir örnek verildi ("I am ill." → "Ben hastayım."). |
| Macarca "nem": "no (a negative answer)" anlamı "cins, cinsiyet, eşey…" ile eşleşmiş | Düzeltildi: 3. anlam "sex, gender; kind, sort" → "cinsiyet; tür, çeşit" (ayrı bir isim). "yasaktır, yok" diye yanlış çevrilmiş 2. anlam gizlendi. 1. anlam "hayır, değil" değişmedi. |

## Bulunan hata türleri ve yapılanlar

1. **Örnek cümle kelimeyi içermiyordu.** Kaynak: Vikisözlük'ün biçim listesine karışan eski yazımlar, ağız
   biçimleri ve Roma rakamları. Örnekler: "one" ve "first" için "I", "my" için "me", "they" için "the", "of" için "a".
   - Bu kelimelere yeni örnek verildi: one, first, my, they, of, we, will, much, many, she, well, good, because, three.
   - Rusçada zamirler (он, мы, ты, они, она, вы, оно, себя) aynı ilgisiz cümleyi kullanıyordu; her birine kendi
     örneği verildi.
   - **Uygulamada genel koruma:** "boşluk doldur" yalnızca kelimenin kendisini ya da onunla aynı iki harfle başlayan
     biçimleri boşaltır. Böylece paketin geri kalanında da "one" için "I" boşaltılmaz.
2. **Örnek kelimenin başka bir anlamını gösteriyordu.** Deyimler: "at a loss for words" (a, for, at), "look after"
   (after), "go about your business" (about), "keeps you up" (up). Diğer uyumsuzluklar:
   - "worked" (fiil), ama öğretilen work = iş (isim);
   - "see you back", ama öğretilen back = arka;
   - "állatok" (hayvanlar), ama öğretilen áll = durmak;
   - "Васко да Гама" (isim), ama öğretilen да = evet.

   Hepsine öğretilen anlamı gösteren kısa örnekler verildi.
3. **Ana anlam yanlıştı ya da en yaygın anlam değildi:**
   - İngilizce:
     - may = "gitmek" → "-ebilmek (izin, olasılık)"
     - now = "-dan, -den" → "şimdi"
     - just = "adil" → "sadece; az önce; tam"
     - day = "gündüz" → "gün"
     - need (isim) → fiil "ihtiyacı olmak"
     - use (isim) → fiil "kullanmak"
     - any → "hiç, herhangi bir"
     - don't → "-me, -ma"
   - Macarca:
     - le = "kuş tüyü" → "aşağı (fiil öneki)"
     - e = "bak!" → "bu (resmî)"
     - ad (Latince edat) → "vermek"
     - igen = "tam, oldukça" → "evet"
     - lett (bozuk açıklama) → "oldu"
     - hisz → "inanmak, sanmak"
     - egy → "bir"
   - Rusça:
     - раз = "eğer" → "kez, defa"
     - да = "ve" → "evet"
     - об → "hakkında"
     - вот, должен, можно, самый, ни, дело ve до için okunabilir anlamlar yazıldı.
4. **Bozuk ya da uygunsuz ikincil anlamlar gizlendi.** Örnekler:
   - об = "âyet-i kerime'ye yemin ederim"
   - у = "yemin ederim" ve "selam olsun"
   - мы = "ı )"
   - minden = "kahretsin"
   - ha = "astonishment"
   - nagy = "anapara"
   - Açıklama cümlesine dönüşmüş anlamlar (не, вот, должен, ő, lett).
5. **Türkçe çeviri yanlıştı:**
   - ma: "Dikkat çekiciydi" → "Bugün okula gitmek istemiyor."
   - van: "Benim ülkemin okyanusa kıyısı vardır" → "Memleketim deniz kenarında."
   - két/sem: "Susuz bir gün daha yaşayamayız" → "Susuz iki gün bile yaşayamayız."
   - бы: "ifade etmek istiyorum" → "isterdim"
   - Rusça "6 раз больше" ve "У него нет работы", Macarca "e héten" ve "semmi" cümleleri ile tırnakları bozuk Hiroshi
     cümlesi düzeltildi.
6. **Aynı Türkçe karşılığı tekrar eden "diğer anlamlar"** (ör. go = gitmek ×3) uygulamada artık tek kez görünüyor.
7. **"Aynı Türkçe anlam, aynı kelime" varsayımı kaldırıldı.** Yazma alıştırmasında, aynı Türkçe karşılığa sahip başka
   bir kelime artık doğru sayılmıyor. Kullanıcıya "benzer olabilir, ama burada istenen bu" diye açıklanıyor.

## Emin olunamayanlar (gözden geçirilmeli)

| Dil | Kelime | Neden |
|---|---|---|
| en | over | Kısa ve "üstünde" anlamını gösteren insan çevirili bir Tatoeba cümlesi bulunamadı; yanlış örnek yerine **örnek kaldırıldı**. |
| en | of | Öğretilen anlam "-in, -ın"; seçilen örnek "I'm one of you." "-den biri" kullanımını gösteriyor. Anlama "-den (biri)" eklendi. |
| en | many, much | Örnekler "How many?" ve "How much?" (kaç tane / ne kadar). Yaygın kalıplar, ama "çok" anlamını doğrudan göstermiyor. |
| en | go | "I have to go to sleep." → "Yatmaya gitmek zorundayım." Anlaşılır ama "go to sleep" bir kalıp ("uyumak"). |
| en | when | Örnek ("It's a pity when somebody dies.") doğru ama başlangıç için ağır bir konu. |
| ru | их | "Onların" anlamını gösteren kısa bir cümle bulunamadı (eski örnek "из них" başka bir kullanım); **örnek kaldırıldı**. |
| ru | мир | Öğretilen 1. anlam "barış", örnek "dünya" anlamını gösteriyor. Anlam sırası, kayıtlı öğrenmeleri etkilememesi için değiştirilmedi. |
| ru | простой | Yeni örnek "игра простая" doğru; eski örnek "просто" (zarf) idi. |
| hu | hát | Eski örnek bozuk bir makine çevirisiydi; "sırt" anlamı için kısa bir cümle bulunamadı, **örnek kaldırıldı**. |
| hu | tart | Öğretilen anlam "tutmak", örnek "sürmek" anlamını gösteriyor ("Konuşma iki saat sürdü"). |
| hu | jól, ki, néz | Üçü de "Ez a férfi jól néz ki." (= "Bu adam yakışıklı") örneğini paylaşıyor; deyimsel. |
| hu | nap | Örnek "her gün" (nap = gün); 1. anlam "gün; güneş" iki anlamı birleştiriyor. |
| hepsi | ikincil anlamlar | Yalnızca açıkça bozuk olanlar gizlendi; Vikisözlük'ten gelen diğer ikincil anlamlar tek tek kontrol edilmedi. |

## Bu denetimin kapsamı dışında kalanlar

- Paketlerin geri kalanı (~3100 kelime/dil) kontrol edilmedi. Biçim listesindeki aynı tür hatalar orada da var. Uygulamadaki
  "boşluk doldur" koruması yanlış boşluk sorusunu engeller, ama yanlış seçilmiş örnek cümleler kalmış olabilir.
  Kalıcı çözüm: `build_content.py` içinde biçimleri Vikisözlük etiketlerine göre süzmek (eski, ağız, kısaltma, Roma
  rakamı) ve paketleri yeniden üretmek. **Yapıldı (2026-11-24), aşağıdaki bölüme bakın.**
- Fransızca, İspanyolca ve Türkçe paketler bu denetime dahil değil. **İlk 100 kelimeleri 2026-11-24'te denetlendi,
  aşağıdaki bölüme bakın.**
- Elle hazırlanmış başlangıç dersleri (yapay zekâ taslağı) bu turda yeniden incelenmedi.
- Durumlara ve kalıp cümlelere dayalı ayrı bir başlangıç yolu henüz yazılmadı. Bugün başlangıç yolu şu sırada ilerliyor:
  Sesler ve Harfler, ardından elle hazırlanmış konu dersleri (yiyecek, ev, selamlaşma), ardından sıklık sırası.
  - **Güncelleme (2026-11-24):** Rusça, İngilizce ve Macarca için beş durum dersi eklendi: selamlaşma ve tanışma, kafede
    ve markette, yol sorma, sayılar ve saat, iş yerinde (tekstil bağlamı). Her derste 4–5 kalıp ifade var. Sıra artık:
    Sesler ve Harfler, elle hazırlanmış konu dersleri, durum dersleri, sıklık sırası. Örnek cümleler Tatoeba'dan alındı ve
    kaynak kimliği saklandı. Tatoeba'da Türkçe çevirisi olmayanların çevirisi "(makine çevirisi)" diye etiketli, düzeltilen
    iki çeviri "(çeviri düzeltildi)" diye etiketli. İçerik yapay zekâ taslağıdır; uzman doğrulaması yoktur.
    Testler: `tests/situations.test.ts`. Fransızca, İspanyolca ve Türkçe için durum dersleri yok.

---

# Ek: biçim listesi süzmesi ve Fransızca, İspanyolca, Türkçe ilk 100 kelime (2026-11-24)

> Bu da bir **yapay zekâ (Claude) incelemesidir**, uzman dilbilimci doğrulaması değildir. Düzeltmeler açık hataları
> giderir; "emin değilim" listesi bir anadili konuşan ya da öğretmen tarafından kontrol edilmelidir.

## 1. Biçim listesi Vikisözlük etiketlerine göre süzüldü

**Sorun:** Vikisözlük'ün biçim listesine eski yazımlar, ağız biçimleri ve Roma rakamları karışıyordu. Örnek cümle bu
yanlış biçimlere göre seçiliyordu: "one" ve "first" için "I", "my" için "me", "they" için "the", "of" için "a".

**Yapılan:** `scripts/content/build_content.py` artık şu etiketleri taşıyan biçimleri listeye almıyor:
- "alternative form" girişleri;
- eski yazımlar (obsolete, archaic, dated; Rusçada devrim öncesi yazım, ör. "былъ");
- ağız biçimleri ve standart dışı yazımlar;
- yazım hataları;
- kısaltmalar;
- Roma rakamları;
- bileşik zamanların yardımcı fiili (ör. Fransızca "être" listesindeki "ayant").

Bir biçim tabloda bir kez eski, bir kez olağan etiketle geçiyorsa (İng. "were") kalır.

**Korunan standart çeşitler:** Vikisözlük bazı standart biçimleri de "alternative" diye etiketliyor. Bunlar elle bir
listeye yazıldı (`scripts/content/overrides.py`, `KEEP_FORMS`). Örnekler:
- Rusça: во, со, изо, об, чтоб;
- Macarca: nincsen, föl, közt, sose;
- İspanyolca: e (y yerine), u (o yerine), gran, ningún;
- Türkçe: mı, mu, mü, hadi, filan.

Yalnızca aksan ya da bitişik harf farkı olan yazımlar (cœur/coeur, connaître/connaitre, hâlâ/hala) ve İngiliz/Amerikan
yazımları (centre, programme) da kalır.

**Etkisi (önceki paketle karşılaştırma):**

| Dil | Biçim listesi kısalan kelime | Örnek cümlesi değişen kelime |
|---|---|---|
| ru | 894 | 4 |
| hu | 114 | 13 |
| fr | 217 | 55 (26'sı elle seçilen yeni örnek) |
| es | 249 | 45 (25'i elle seçilen yeni örnek) |
| en | 1378 | 62 |
| tr | 127 | 33 (19'u elle seçilen yeni örnek) |

Süzmenin kendiliğinden düzelttiği örnekler:
- İngilizce: "inch" için "in", "butt" için "but", "khan" için "can" içeren cümleler gitti.
- Fransızca: "partir" ve "passer", "avoir" içeren ilgisiz bir cümle yerine kendi cümlelerini aldı.

Uygulamada "boşluk doldur" ve cümle kurma kontrolü de bu listeyi kullanır. Artık "I" ile başlayan bir cümle "one"
kelimesini içeriyor sayılmaz.

**Kimlikler değişmedi.** Kelime sırası, anlam kimlikleri (`g:<dil>:<kelime>#n`) ve ders kimlikleri (`g-<dil>-<n>`)
altı dilde de önceki paketle birebir aynı. Gizlenen anlamlar dahil hiçbir numara kaymadı. Bunun için sıralama
bilerek eski, süzülmemiş biçimlerle yapılıyor.

**Sınama yolu:** `scripts/content/preview_forms.py` seçilen kelimelerin önceki ve sonraki biçim listesini yazdırır.
Kalıcı testler: `tests/contentQuality.test.ts`.

## 2. Fransızca, İspanyolca, Türkçe ilk 100 kelime

Yöntem: `scripts/content/audit_examples.py` ile örnek cümle denetimi, ardından anlamların ve çevirilerin tek tek
okunması. Yeni örneklerin hepsi Tatoeba'dan alındı (kaynak kimliği saklı).

| Dil | Düzeltilen kelime | Yeni örnek | Düzeltilen anlam | Gizlenen anlam | Düzeltilen cümle çevirisi |
|---|---|---|---|---|---|
| fr | 49 | 26 | 31 | 18 | 5 |
| es | 72 | 25 | 56 | 47 | 3 |
| tr | 62 | 19 | 79 | 11 | 0 |

**Türkçe paket (en ciddi sorun).** Türkçe Vikisözlük tanımları İngilizce anlamlarla sırayla eşlenmiş, bu yüzden
kaymışlardı. Örnekler:
- şey = "erkeklik organı" → "herhangi bir nesne, olay ya da durum" (uygunsuz anlam gizlendi);
- gün = "Güneş" → "24 saatlik süre";
- iyi = "aşırı, bol, çok" → "beğenilen, istenilen nitelikleri taşıyan";
- etmek = "birini bir şeyden mahrum bırakmak" → "yapmak, kılmak";
- bilmek, yaşamak, olmak, daha, o, hak, sonra ve diğer 40'tan fazla kelimede yanlış eşleşmeler düzeltildi.

Türkçe örneklerde başka bir kelime öğretiliyordu:
- varmak için "var";
- iç ve içmek için "için";
- il için "ile";
- baş için "başlar";
- birlik için "birlikte";
- hak için "hakkında".

Hepsine kelimenin kendisini gösteren kısa cümleler verildi. Türkçe paketteki çeviriler İngilizcedir;
`apply_corrections.py` artık düzeltilen örneğin İngilizce çevirisini de taşıyor.

**Fransızca.**
- Örnek cümle başka bir kelimeyi gösteriyordu:
  - mai (mayıs) için "mais";
  - plaire için "plus";
  - nouveau için "nouvelle" (haber);
  - ils için "il";
  - un, nous, vous, elle, peu ve votre için kelimeyi hiç içermeyen cümleler.
- Anlam yanlışları:
  - non = "yasaktır, yok" → "hayır; değil";
  - comme = "hoşlanmak, sevmek" → "gibi";
  - aussi'nin ana anlamı "bu yüzden" → "de, da; ayrıca";
  - personne = "kimse yok / herkes" → "hiç kimse / herhangi biri";
  - encore = "daha" → "hâlâ; henüz";
  - être = "imek" → "olmak; -dir".
- Bozuk makine çevirisi anlamlar gizlendi: "ı want to may", "başkası için substitutes", "iyi gökler".

**İspanyolca.**
- Örnek cümle başka bir kelimeyi gösteriyordu:
  - ver için "Ven a mi casa" (venir);
  - nuevo için "Nueva York";
  - unir için "una";
  - parar için "para";
  - partir için "partes";
  - el, ella, él, yo ve ustedes için kelimeyi içermeyen cümleler.
- Anlam yanlışları:
  - no = "yasaktır, yok" → "hayır";
  - solo = "taban, dil balığı" → "tek, biricik";
  - tiempo = "hava" → "zaman, vakit";
  - donde = "çünkü" → "-diği yer";
  - primero = "önceki" → "birinci, ilk".
- Bozuk makine çevirileri gizlendi: "nouns'tan ad hoc fiilleri oluşturmak", "emphatic negations'da kullanılır".

## 3. Emin olunamayanlar ve sınırlar

| Dil | Konu | Neden |
|---|---|---|
| hepsi | Sıralama | Kelime sırası kimlikler değişmesin diye hâlâ süzülmemiş biçimlerle hesaplanıyor. Bu yüzden bazı kelimelerin yeri yanlış biçimlerin sıklığıyla şişmiş: fr "mai" (mais), "plaire" (s'il vous plaît), es "unir" (una), "parar" (para). Bunlar ilk 100'de kalıyor; örnek cümleleri düzeltildi. |
| fr, es, ru | Zamir tabloları | Vikisözlük'ün zamir tablosu öteki zamirleri de biçim sayıyor (он → я, ты; elle → lui; él → ella). Etiketle ayrılamıyor; ilk 100'deki örnekler elle düzeltildi, paketin geri kalanında kalmış olabilir. |
| tr | Fiil örnekleri | Türkçe fiillerin çoğu çekimi (olduğun, vardık, yedim) biçim listesinde yok. Örnekler doğru ama uygulama bu cümlelerde boşluk doldurma sorusu kuramaz. |
| tr | varmak | Yeni örnek "Biz vardık." hem "ulaştık" hem "oradaydık" diye okunabilir; Tatoeba'daki İngilizcesi "We've arrived". |
| es | dar, poner, saber, poder | Örnekler düzensiz çekim kullanıyor (di, puso, sé, puedo); doğru ama boşluk doldurmaya uygun değil. |
| es | ante | Yeni örnek "Deberías disculparte ante mí." Türkçesi "Benden özür dilemelisin." ("ante" doğrudan çevrilmiyor). |
| fr | faire, la | Eski örnek ("mordre la poussière") bir deyimdi; yenileri basit cümleler. |
| hepsi | ikincil anlamlar | Yalnızca açıkça bozuk olanlar düzeltildi ya da gizlendi. Diğer ikincil anlamlar tek tek kontrol edilmedi. |

Paketlerin ilk 100'den sonraki kısmı (~3100 kelime/dil) yine elle denetlenmedi. Biçim süzmesi oradaki örnek
seçimini de iyileştirdi, ama anlam kaymaları (özellikle Türkçe pakette) kalmış olabilir.
