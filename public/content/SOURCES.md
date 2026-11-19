# Kelime paketleri — kaynaklar ve lisans

Bu klasördeki `*/words-*.json` dosyaları `scripts/content/build_content.py` ile aşağıdaki açık kaynaklardan
otomatik üretilmiştir. Üretilen paketler **CC BY-SA 4.0** lisanslıdır. Uzman doğrulamasından geçmemiştir.

| Kullanım | Kaynak | Lisans |
|---|---|---|
| Kelime sıklığı ve sırası | [wordfreq](https://github.com/rspeer/wordfreq) (Robyn Speer ve ark.), ~2021'e kadarki veri | CC BY-SA 4.0 (bazı alt kaynakların ek atıf şartları var) |
| Sözlük biçimi, anlamlar (İngilizce), çekimler, IPA, Rusça vurgu ve harf çevirisi, ses dosyası adresleri | İngilizce Vikisözlük — [Wiktextract / kaikki.org](https://kaikki.org/) (Ekim 2026 dökümü) | CC BY-SA 4.0 / GFDL |
| Türkçe anlamlar | Türkçe Vikisözlük (Wiktextract), İngilizce Vikisözlük çeviri tabloları; bulunamayanlarda [Argos Translate](https://www.argosopentech.com/) İngilizce→Türkçe modeli ile makine çevirisi | CC BY-SA 4.0; Argos modeli açık kaynak |
| Örnek cümleler ve insan çevirileri | [Tatoeba](https://tatoeba.org/) (14 Kasım 2026 dışa aktarımı) | CC BY 2.0 FR (bazı cümleler CC0) |
| Ses kayıtları | [Wikimedia Commons](https://commons.wikimedia.org/) (çoğu [Lingua Libre](https://lingualibre.org/)); dosya adresleri pakette, dosyalar Wikimedia'dan çalınır | Dosya bazında (çoğunlukla CC BY-SA); her dosyanın lisansı kendi sayfasında |
| Emoji eşleşmesi | [emojibase-data](https://emojibase.dev/) (Unicode CLDR adları) | MIT |

Her kelimedeki Türkçe anlamın kaynağı `m[].ts` alanında, örnek cümlenin kaynağı `x.src` alanında (`tatoeba:<id>`)
ve Türkçe çevirinin makine çevirisi olup olmadığı `x.trs` alanında saklanır; uygulama bunları kullanıcıya gösterir.

Kısa alan adları: `r` sıklık sırası, `w` sözlük biçimi, `p` sözcük türü, `m` anlamlar (`en`, `tr`, `ts`, `pos`),
`f` çekimli biçimler, `s` vurgulu yazılış, `t` harf çevirisi, `i` IPA, `a` ses (`u` adres, `f` Commons dosya adı),
`x` örnek cümle, `e` emoji.
