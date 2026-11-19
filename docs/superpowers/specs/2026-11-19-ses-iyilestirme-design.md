# Ses iyileştirmesi — tasarım (küçük değişiklik)

Tarih: 2026-11-19 · Onay: kullanıcı, sohbet içinde ("onaylıyorum ispanyolcayıda ekle")

## Amaç ve neden
Bir dile sıfırdan başlarken doğru telaffuzu dokunduğu anda, güvenilir şekilde duymak. Ek ücret yok.

iPhone 15 Pro (iOS 27.2, ana ekran uygulaması) üzerindeki ses testi ve kullanıcı gözlemi:
- Ses çalıyor; 6 dilin hepsinde cihaz sesi var.
- Dokununca ses gecikiyor.
- İnsan kaydı çalarken Dynamic Island "müzik çalıyor" gibi hareketleniyor (kayıtlar `HTMLAudioElement` + `audioSession.type = 'playback'` ile çalındığı için iOS bunu medya sayıyor).
- "ház" gibi elle hazırlanmış kelimeler, Sesler ve Harfler örneklerinde insan kaydı yerine cihaz sesiyle çalıyor (örnek arama yalnızca `generated` anlamlara bakıyor).
- Ses testi raporu, yüklenmemiş dil paketleri için yanlışlıkla "insan kaydı yok" diyor.
- İspanyolca pakette insan kaydı neredeyse yok (22/3200).

## Hedefler
1. İnsan kaydı dokununca hemen başlar, Dynamic Island'da görünmez, sessiz modda da çalar.
2. Ekrana gelen kelimelerin kayıtları önceden indirilip cihazda saklanır.
3. Elle hazırlanmış kelimeler ve Sesler ve Harfler örnekleri paketteki insan kaydını bulur; kayıt, dokunma anında okunur (paket sonradan yüklense bile).
4. Ses testi: yüklenmemiş dil için "paket yüklenmedi" ve "Paketi yükle" düğmesi; raporda sesin hangi yolla çaldığı (anında / oynatıcı / cihaz sesi).
5. Cihaz sesi kullanılınca "Duymuyorsan sessiz modu kapatmayı dene" ipucu.
6. İspanyolca kelimelere İspanyolca Vikisözlük'ten (kaikki.org, ücretsiz) insan sesi eklenir.

## Hedef dışı
- Ücretli ses hizmetleri, yeni yapay ses.
- Sessiz mod / müzikle karışma arasında geçiş ayarı (kullanıcı A'yı seçti; gerekirse sonra).
- Diğer dillere yeni ses kaynağı.

## Kaçınılacak (başarısızlık sayılır)
- Sesin hiç çalmaması: yeni yöntem kullanılamazsa bugünkü oynatıcıya, o da olmazsa cihaz sesine düşülür.
- Telefonda bellek şişmesi: çözülmüş ses sayısı sınırlı tutulur.

## Kısıtlar
- iOS: ses yalnızca dokunuşla başlatılabilir; hiçbir ses kendiliğinden çalmaz.
- Kullanıcı seçimi **A**: sessiz modda da çalsın; arkadaki müzik durabilir (`audioSession.type = 'playback'` kalır).
- Ses dosyaları yalnızca Wikimedia'dan; lisans bilgisi korunur.

## Yaklaşımlar
- **Seçilen — kısa efekt sesi (Web Audio) + önceden indirme:** kayıtlar indirilip çözülür, dokununca `AudioBufferSourceNode` ile anında çalar. Web Audio, iOS'ta "şu an çalıyor" (Dynamic Island) kaydı oluşturmaz. Ses oturumu `playback` olduğu için sessiz modda da duyulur.
- Mevcut oynatıcıyı tutup yalnızca önceden indirmek: gecikmeyi azaltır ama Dynamic Island görüntüsü kalır.
- Her şeyi cihaz sesine çevirmek: ada ve gecikme biter ama gerçek insan sesi kaybolur.

## Kararlaştırılanlar
- Yöntem: Web Audio + önceden indirme; yedek olarak bugünkü `HTMLAudioElement`, sonra cihaz sesi.
- A seçeneği (sessiz modda çal).
- İspanyolca Vikisözlük verisi (kaikki.org, ~98 MB) indirilir ve yalnızca İspanyolca paketin ses alanı için kullanılır.

## Uygulayıcıya bırakılanlar
- Çözülmüş ses önbelleğinin boyutu, boşta kalınca ses bağlamının askıya alınma süresi.
- Ses testi ekranının düzeni ve rapor satırlarının biçimi.
- İspanyolca Vikisözlük kayıtlarının hangi alanlardan okunacağı ve birden fazla kayıt varsa hangisinin seçileceği.

## Doğrulama
- Otomatik testler (yeni: kayıt arama, İspanyolca ses kapsamı) + bilgisayarda tarayıcı denemesi.
- Dynamic Island ve gecikme yalnızca iPhone'da doğrulanabilir: yayından sonra kullanıcı Ses testi raporunu yeniden gönderir.
