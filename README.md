# TOMAN MAFIA — لعبة المافيا عبر الإنترنت

لعبة مافيا كلاسيكية لاصدقائك في غرفة واحدة، بواجهة عربية RTL وتصميم سينمائي مستوحى من لوحات البطاقات.

## التشغيل

```bash
npm install   # مرة واحدة فقط
npm start     # http://localhost:3000
```

المتطلب: Node.js 18 أو أحدث.

## الاختبارات

```bash
npm test                  # محاكاة المحرك + الخادم الحي (40 تحقق)
node test/browser-check.js  # فحص المتصفح عبر CDP + لقطات في .shots/
```

## مشاركة مع الأصدقاء (جلسة مؤقتة مجانية)

شغّل الخادم محليًا `npm start`، ثم افتح نفقًا سريعًا من Cloudflare بدون تسجيل:

- **ويندوز** — نزّل [cloudflared-windows-amd64.exe](https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe) ثم:
  ```bash
  cloudflared.exe tunnel --url http://localhost:3000
  ```
- **لينكس / ماك**:
  ```bash
  cloudflared tunnel --url http://localhost:3000
  ```

سيعطيك رابط من طرفه `https://....trycloudflare.com` — أرسله لاصدقائك وابدأوا الغرفة.

## طريقة اللعب

1. أنشئ غرفة وانشر الرمز (5 محارف) لاصدقائك، أو انضم برمز.
2. المضيف يبدأ عند اكتمال 5 لاعبين على الأقل (حتى 15).
3. توزَّعت الأدوار: مافيا ♠، طبيب ♥، محقق ♦، مواطنون ♣.
4. المراحل بالتناوب: **ليل → فجر → نهار → تصويت**، حتى ينتصر أحد الفريقين.

| الدور | هدفه |
| --- | --- |
| المافيا ♠ | تقتل ليلًا حتى تصبحوا ≥ بقية المدينة |
| الطبيب ♥ | يحمي شخصًا واحدًا كل ليلة |
| المحقق ♦ | يفحص شخصًا كل ليلة ويعرف حقيقته |
| المواطن ♣ | يقرأ الغرفة وصوّت على المشتبه به |

## بنية المشروع

```
server/   الخادم: index.js (HTTP + WebSocket)، game.js (المحرك)، rooms.js، rules.js
public/   الواجهة: index.html، css/، js/، خطوط محلية
test/     smoke.js (npm test) و browser-check.js (لقطات المتصفح)
```

التقنية: Node.js + `ws` فقط، واجهة vanilla JS — بلا خطوة بناء، وبلا اعتماديات إضافية.
