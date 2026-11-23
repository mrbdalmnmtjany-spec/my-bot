# تحديث السيرفر لإدارة المنتجات من البوت

حالياً المنتجات مكتوبة ثابتة داخل كود السيرفر، لذلك لا يمكن إضافتها من الخارج.
أضف هذا الكود إلى ملف السيرفر (server.js) **بدلاً من** مسار `app.get('/api/services', ...)` الحالي.

> استبدل `auth` و `adminOnly` بأسماء دوال التحقق الموجودة عندك (نفس المستخدمة في `/api/admin/add-balance`).
> واستبدل `DEFAULT_SERVICES` بمصفوفة الخدمات الحالية الموجودة في الكود.

```js
const serviceSchema = new mongoose.Schema({
  id: { type: String, unique: true }, name: String, category: String,
  price: Number, min: Number, max: Number, desc: String,
});
const Service = mongoose.models.Service || mongoose.model('Service', serviceSchema);

// أول تشغيل: نقل الخدمات الحالية إلى قاعدة البيانات
mongoose.connection.once('open', async () => {
  if (await Service.countDocuments() === 0) await Service.insertMany(DEFAULT_SERVICES);
});

// عرض المنتجات (للموقع والبوت)
app.get('/api/services', async (req, res) => {
  res.json(await Service.find({}, { _id: 0, __v: 0 }).lean());
});

// إضافة منتج (أدمن فقط)
app.post('/api/admin/services', auth, adminOnly, async (req, res) => {
  const { id, name, category, price, min, max, desc } = req.body;
  if (!id || !name || !category || !(price > 0)) return res.status(400).json({ message: 'بيانات ناقصة' });
  await Service.create({ id, name, category, price: +price, min: +min, max: +max, desc });
  res.json({ message: 'تمت إضافة المنتج ✅' });
});

// حذف منتج (أدمن فقط)
app.delete('/api/admin/services/:id', auth, adminOnly, async (req, res) => {
  const r = await Service.deleteOne({ id: req.params.id });
  if (!r.deletedCount) return res.status(404).json({ message: 'المنتج غير موجود' });
  res.json({ message: 'تم حذف المنتج ✅' });
});
```

وتأكد أن مسار الطلب `/api/order` يبحث عن الخدمة من قاعدة البيانات:
```js
const service = await Service.findOne({ id: req.body.serviceId }).lean();
```
