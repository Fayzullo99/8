# LogiChain

Blockchain asosidagi logistika tizimi MVP.

## Imkoniyatlar

- Mahsulotni tizimga birinchi marta kiritish
- Mahsulot lokatsiyasini real vaqtga yaqin rejimda kuzatish
- Yetkazib berish holatini yangilash
- Mahsulot haqiqiyligini blockchain yozuvlari orqali tekshirish
- Mahsulot egasini o'zgartirish: ishlab chiqaruvchi -> distribyutor -> sotuvchi
- Butun supply chain tarixini audit qilish
- Responsive va zamonaviy dashboard

## Ishga tushirish

```bash
node server.js
```

Brauzerda oching:

```text
http://localhost:3000
```

## API

- `GET /api/dashboard`
- `POST /api/products`
- `POST /api/products/:id/location`
- `POST /api/products/:id/status`
- `POST /api/products/:id/transfer`
- `POST /api/products/:id/verify`
- `GET /api/products/:id/audit`

## Deploy

Render uchun `render.yaml` qo'shilgan. Repo GitHub ga push qiling va Render'da `Blueprint` yoki oddiy Web Service sifatida ulang.

Start command:

```text
node server.js
```
