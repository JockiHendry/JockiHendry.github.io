---
layout: post
category: Pemograman
title: Memakai Mailgun Untuk Custom Domain Email Pribadi
tags: [Email]
---

Saya sudah sering menggunakan Mailgun dan Sendgrid untuk mengirim notifikasi email melalui kode program dan menerima *reply* email dari pengguna untuk diproses aplikasi web yang sedang saya kerjakan.  Kali ini, saya tidak akan melakukan hal *'biasa'* tersebut dengan Mailgun.  Kasus kali ini adalah masalah pribadi:  saya ingin punya akun email seperti `owner@jocki.me` yang dibuka melalui Gmail tanpa harus membayar $5 per user per bulan (langganan G Suite).

Pada menu *Routes* di Mailgun, saya bisa membuat sebuah *route* baru untuk menangani email yang masuk (*incoming email*) agar men-*forward* email tersebut ke akun Gmail saya, seperti yang terlihat pada gambar berikut ini:

![Membuat route baru]({{ "/assets/images/gambar_00017.png" | relative_url}}){:class="img-fluid rounded"}

Karena akun Mailgun menyediakan plan gratis untuk 10.000 email pertama setiap bulannya, saya kini bisa menerima email melalui akun Gmail secara gratis.  Saya pun tetap bisa menggunakan aplikasi Android Gmail untuk memeriksa email (tanpa harus membuka web pihak ketiga).  Ini adalah salah satu fitur menarik Mailgun yang tidak melibatkan pemograman sama sekali.

Yang lebih menariknya, bila saya mengubah nilai *Expression Type* menjadi *Catch All*, saya dapat menerima email yang ditujukan untuk `@jocki.me`, bukan hanya `owner@jocki.me` tapi juga `support@jocki.me`, `contact@jocki.me`, dan sebagainya.  Mengingat bahwa layanan G Suite adalah $5 per user dan kini saya bisa memiliki *unlimited user*, ini adalah penghematan yang cukup besar :)