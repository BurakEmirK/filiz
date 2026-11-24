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
  rakamı) ve paketleri yeniden üretmek.
- Fransızca, İspanyolca ve Türkçe paketler bu denetime dahil değil.
- Elle hazırlanmış başlangıç dersleri (yapay zekâ taslağı) bu turda yeniden incelenmedi.
- Durumlara ve kalıp cümlelere dayalı ayrı bir başlangıç yolu henüz yazılmadı. Bugün başlangıç yolu şu sırada ilerliyor:
  Sesler ve Harfler, ardından elle hazırlanmış konu dersleri (yiyecek, ev, selamlaşma), ardından sıklık sırası.
  - **Güncelleme (2026-11-24):** Rusça, İngilizce ve Macarca için beş durum dersi eklendi: selamlaşma ve tanışma, kafede
    ve markette, yol sorma, sayılar ve saat, iş yerinde (tekstil bağlamı). Her derste 4–5 kalıp ifade var. Sıra artık:
    Sesler ve Harfler, elle hazırlanmış konu dersleri, durum dersleri, sıklık sırası. Örnek cümleler Tatoeba'dan alındı ve
    kaynak kimliği saklandı. Tatoeba'da Türkçe çevirisi olmayanların çevirisi "(makine çevirisi)" diye etiketli, düzeltilen
    iki çeviri "(çeviri düzeltildi)" diye etiketli. İçerik yapay zekâ taslağıdır; uzman doğrulaması yoktur.
    Testler: `tests/situations.test.ts`. Fransızca, İspanyolca ve Türkçe için durum dersleri yok.
