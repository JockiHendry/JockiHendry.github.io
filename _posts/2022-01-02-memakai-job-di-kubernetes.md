---
layout: post
category: DevOps
title: Memakai Job Di Kubernetes
tags: [Kubernetes]
---

Job adalah sebuah *resource* di Kubernetes yang dipakai untuk mengerjakan sebuah tugas hingga selesai.   Berbeda dengan Service yang selalu hidup, begitu tugas Job selesai, *pod* yang berkaitannya dengannya akan dimatikan.  Dengan demikian, Job cocok untuk pekerjaan infrastruktur yang konsisten namun hanya perlu dilakukan sesekali saja seperti *backup* dan *restore* database.  Sebagai latihan, saya akan membuat sebuah Job untuk melakukan konfigurasi Keycloak seperti membuat *realm*, *client* dan *user* baru.

Selama ini, sebelum aplikasi [latihan-k8s](https://github.com/JockiHendry/latihan-k8s/tree/419d265ff195a43e1b8cedd45b4f975f97de3e56) dapat dipakai, saya harus membuka dashboard Keycloak di browser dan mengisi informasi secara manual. Dengan membuat Job yang mewakili aktivitas ini, saya hanya perlu menjalankan Job tersebut saat Service `keycloak` selesai dibuat.  Keycloak sendiri sudah menyediakan [Admin CLI](https://www.keycloak.org/docs/latest/server_admin/#admin-cli) khusus untuk konfigurasi melalui CLI tanpa perlu membuka halaman web.  Sebagai contoh, saya membuat *manifest* dengan nama `keycloak-setup-job.yaml` dengan isi seperti berikut ini :

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: keycloak-setup-job  
spec:
  ttlSecondsAfterFinished: 100
  backoffLimit: 1
  template:
    spec:
      containers:
        - name: keycloak-setup-job
          image: 'docker.io/bitnami/keycloak:15.0.2-debian-10-r94' # kpt-set: docker.io/bitnami/keycloak:${keycloak_version}
          command: ["/bin/sh"]
          args:
            - "-c"
            - >
                kcadm.sh create realms -s realm=latihan -s enabled=true --no-config --server https://auth.latihan.jocki.me/auth --realm master --user user --password password;
                kcadm.sh create clients -r latihan -s clientId=latihan-k8s -s 'redirectUris=["https://web.latihan.jocki.me/*"]' -s 'webOrigins=["*"]' -s publicClient=true -s protocol=openid-connect -s enabled=true --no-config --server https://auth.latihan.jocki.me/auth --realm master --user user --password password;
                kcadm.sh create users -r latihan -s username=admin -s email=admin@jocki.me -s emailVerified=true -s enabled=true --no-config --server https://auth.latihan.jocki.me/auth --realm master --user user --password password;
                kcadm.sh set-password -r latihan --username admin -p 12345678 --no-config --server https://auth.latihan.jocki.me/auth --realm master --user user --password password;
      restartPolicy: Never
```

Pada Job di atas, hanya akan ada satu *pod* yang dibuat berdasarkan *image* `bitnami/keycloak`.  Karena ingin cepat, saya langsung menyertakan perintah *shell script* ke dalam `args`.  Biasanya `args` dalam bentuk *array* seperti `['echo', 'hallo']`, namun di YAML, bentuk *sequence* juga kompatibel dengan *array* dan lebih enak dilihat untuk baris yang panjang.  Saya memisahkan perintah ke beberapa baris berbeda dengan menggunakan tanda `>`.  Di `args` tersebut, saya mengerjakan perintah seperti `kcadm.sh create realms` untuk membuat *realm* baru, `kcadm.sh create clients` untuk membuat *client* baru, `kcadm.sh create users` untuk membuat *user* baru dan `kcadm.sh set-password` untuk menentukan kata sandi bagi *user* baru tersebut.

<div class="alert alert-info" role="alert">
<strong>TIPS:</strong> Di YAML, untuk memisahkan teks yang panjang menjadi lebih dari satu baris, gunakan tanda <code>|</code> bila hasil akhirnya harus dalam bentuk baris berbeda atau gunakan tanda <code>&gt;</code> bila hasil akhirnya harus digabungkan menjadi satu baris tunggal.  
</div>

Saya menggunakan nilai `Never` untuk `restartPolicy` sehingga bila terjadi kesalahan, *pod* tidak akan dijalankan ulang.  Job Controller akan membuat *pod* baru untuk mengerjakan kembali Job ini setiap kali terjadi kesalahan.  Secara *default*, Job Controller akan mengulangi ini hingga maksimum 6 kali sesuai dengan nilai *default* untuk `backoffLimit`.  Karena tidak ingin Job ini dijalankan berulang kali saat terjadi kesalahan, saya mengisi nilai `backoffLimit` dengan `1`.

Bila Job sudah selesai dikerjakan, *pod*-nya tidak akan dihapus walaupun sudah tidak aktif.  Salah satu tujuannya adalah supaya informasi Job tersebut seperti status sukses atau gagal, *log*, dan sebagainya tetap dapat dilihat (karena Job bisa saja berjalan dalam waktu lama sehingga ditinggal saat bekerja).  Untuk menghapus Job beserta dengan seluruh *pod* yang berkaitan dengannya, saya dapat memberikan perintah `kubectl delete job`.  Namun, ada juga cara otomatis untuk menghapus Job yaitu dengan menggunakan nilai `ttlSecondsAfterFinished`.  Sebagai contoh, saya menambahkan nilai `100` pada `ttlSecondsAfterFinished` sehingga Job berserta dengan *pod*-nya akan otomatis dihapus 100 detik setelah Job tersebut selesai dikerjakan (baik sukses maupun gagal).

Untuk menjalankan Job, saya dapat memberikan perintah seperti:

> <strong>$</strong> <code>kubectl apply -f keycloak-setup-job.yaml</code>

> <strong>$</strong> <code>kubectl get jobs</code>

```
NAME                 COMPLETIONS   DURATION   AGE
keycloak-setup-job   1/1           5s         45s
```

Walaupun sampai disini Job sudah bekerja, terlihat bahwa saya menggunakan nama user dan password secara langsung pada perintah *shell script* yang saya tulis.  Ini melanggar prinsip keamanan komputer karena *file* ini akan di-*commit* dan bisa dilihat oleh siapa saja yang memiliki akses ke *repository*.  Untuk meningkatkan keamanan, saya dapat melakukan sedikit modifikasi agar menggunakan nilai dari Secrets yang disuntikkan ke dalam *environment variables* seperti yang terlihat pada:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: keycloak-setup-job  
spec:
  ttlSecondsAfterFinished: 100
  backoffLimit: 1
  template:
    spec:
      containers:
        - name: keycloak-setup-job
          image: 'docker.io/bitnami/keycloak:15.0.2-debian-10-r94' # kpt-set: docker.io/bitnami/keycloak:${keycloak_version}
          env:
            - name: ADMIN_USERNAME
              valueFrom:
                configMapKeyRef:
                  name: keycloak-env-vars
                  key: KEYCLOAK_ADMIN_USER
            - name: ADMIN_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: keycloak
                  key: admin-password
            - name: USER_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: keycloak
                  key: user-password
          command: ["/bin/sh"]
          args:
            - "-c"
            - >
                kcadm.sh create realms -s realm=latihan -s enabled=true --no-config --server https://auth.latihan.jocki.me/auth --realm master --user ${ADMIN_USERNAME} --password ${ADMIN_PASSWORD};
                kcadm.sh create clients -r latihan -s clientId=latihan-k8s -s 'redirectUris=["https://web.latihan.jocki.me/*"]' -s 'webOrigins=["*"]' -s publicClient=true -s protocol=openid-connect -s enabled=true --no-config --server https://auth.latihan.jocki.me/auth --realm master --user ${ADMIN_USERNAME} --password ${ADMIN_PASSWORD};
                kcadm.sh create users -r latihan -s username=admin -s email=admin@jocki.me -s emailVerified=true -s enabled=true --no-config --server https://auth.latihan.jocki.me/auth --realm master --user ${ADMIN_USERNAME} --password ${ADMIN_PASSWORD};
                kcadm.sh set-password -r latihan --username admin -p ${USER_PASSWORD} --no-config --server https://auth.latihan.jocki.me/auth --realm master --user ${ADMIN_USERNAME} --password ${ADMIN_PASSWORD};
      restartPolicy: Never
```

Pada *manifest* di atas, saya menyuntikkan informasi dari Secret untuk keycloak di file [secret.yaml](https://github.com/JockiHendry/latihan-k8s/blob/419d265ff195a43e1b8cedd45b4f975f97de3e56/kubernetes/keycloak/templates/secrets.yaml) sebagai *environment variables* `ADMIN_USERNAME`, `ADMIN_PASSWORD` dan `USER_PASSWORD`.  Nilai *environment variables* tersebut dapat langsung saya pakai di *shell script*.

Isi dari file *manifest* secret.yaml tersebut terlihat seperti berikut ini:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: keycloak  
type: Opaque
data:
  admin-password: cGFzc3dvcmQ=
  management-password: RnNZOXhpajNCdQ==
  user-password: MTIzNDU2Nzg=
```

Walaupun terlihat seperti bukan teks biasa, nilai di atas adalah nilai yang tidak di-enkripsi, melainkan hanya di-*encode*.  Siapa saja bisa menggunakan perintah `base64` di Ubuntu mengubah meng-*encode* dan men-*decode* nilai password yang ada di file tersebut seperti pada contoh berikut ini:

> <strong>$</strong> <code>echo -n MTIzNDU2Nzg= | base64 -d</code>

```
12345678
```

> <strong>$</strong> <code>echo -n 12345678 | base64</code>

```
MTIzNDU2Nzg=
```

Oleh sebab itu, file Secret tetap perlu di-enkripsi dengan menggunakan *tool* seperti Mozilla SOPS atau Bitnami Sealed Secrets.

Selain Job yang dikerjakan secara manual, Kubernetes juga memiliki Job khusus yang disebut CronJob.  Sesuai dengan namanya, CronJob adalah Job yang akan dikerjakan secara teratur sesuai dengan jadwal cron yang diberikan.  CronJob dapat dideklarasikan dengan *manifest* seperti berikut ini:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: test-cron-job
spec:
  schedule: "*/1 * * * *"
  jobTemplate:
    ...
```

Pada deklarasi di atas, nilai cron yang dipakai di `schedule` menunjukkan kalau Job tersebut akan dikerjakan setiap menit.  Ini adalah batas waktu paling kecil yang bisa diberikan karena CronJob tidak mendukungan satuan detik (seperti setiap 10 detik).  Lagipula, sama seperti *scheduler* pada umumnya, CronJob tidak ditujukan untuk proses yang membutuhkan akurasi tinggi.

Sebagai contoh, apabila saya memiliki daftar antrian peserta yang perlu dihubungi sesuai dengan jadwal yang telah ditentukan, salah satu solusi naif adalah dengan mendaftarkan jadwal setiap peserta sebagai sebuah CronJob baru.  Dalam hal ini boleh dibilang *cron* dipakai sebagai *scheduler* dimana CronJob dikerjakan sekali saja. Namun bila jadwal-nya bersifat dinamis (misalnya jadwal peserta berikutnya dipercepat saat ada peserta yang tidak hadir), metode ini akan menjadi rumit karena harus melakukan sinkronisasi jadwal setiap CronJob yang ada.  Selain itu, Kubernetes tidak menjanjikan eksekusi CronJob selalu lancar; pada kasus tertentu, CronJob akan dikerjakan dua kali atau bahkan dilewati sama sekali.

Oleh sebab itu, cara yang lebih disarankan adalah menggunakan CronJob sebagai *ticker* dimana hanya butuh sebuah CronJob yang selalu bekerja setiap menit atau jam (sesuai dengan granularitas yang dibutuhkan).  Setiap kali dikerjakan, CronJob ini akan memeriksa jadwal peserta dan bila ada peserta yang harus dihubungi, ia akan mengerjakan proses untuk menghubungi peserta tersebut.  Dengan demikian, bila terjadi masalah yang menyebabkan eksekusi CronJob terlewati, peserta tetap akan dihubungi di menit berikutnya.  Namun, bila *ticker* perlu berjalan dalam satuan detik, ini akan lebih tepat bila di-implementasi-kan sebagai bagian dari aplikasi.  Sebagai contoh, kasus seperti "terdapat batas waktu 30 detik bagi peserta untuk menjawab dan bila tidak ada jawaban dalam 30 detik, peserta berikutnya akan dihubungi" menunjukkan aplikasi membutuhkan presisi dan akurasi yang lebih tinggi sehingga lebih tepat bila di-implementasi-kan dengan fasilitas *ticker* di bahasa pemograman yang dipakai (seperti `Ticker` di Go atau `setTimer()`/`setInterval()` di JavaScript).