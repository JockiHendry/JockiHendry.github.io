---
layout: post
category: DevOps
title: Memakai Persistent Volume Di Kubernetes
tags: [Kubernetes, Python]
---

Saat sebuah *pod* di-*restart*, seluruh perubahan di dalam *container*-nya akan hilang.  Ini tidak menjadi masalah untuk *service* yang *stateless* seperti [stock-item-service](https://github.com/JockiHendry/latihan-k8s/tree/71370d962bb44a7130ed7d0be556a161e9697535/stock-item-service) yang hanya mengerjakan aksi seperti validasi dan membaca/menyimpan data di database MongoDB dan Elasticsearch.  Setelah *service* tersebut di-*restart*, ia tetap akan bekerja dengan baik (dengan memory yang *'segar'*).  Namun, bagaimana dengan *service* lain seperti database atau *service* yang menangani file yang di-*upload* oleh pengguna?  File-file yang sudah ditulis tentu saja tidak boleh hilang saat *pod* di-*restart*.

Sebagai latihan, saya akan membuat *service* baru dengan nama [file-upload-service](https://github.com/JockiHendry/latihan-k8s/tree/71370d962bb44a7130ed7d0be556a161e9697535/file-upload-service) yang berfungsi untuk mendukung operasi seperti *upload* dan *download* file.   Khusus untuk proses *upload*, *service* ini akan menggunakan bahasa Python dengan framework Flask.  Sebagai contoh, saya membuat file [app.py](https://github.com/JockiHendry/latihan-k8s/blob/main/file-upload-service/app.py) dengan isi seperti berikut ini:

```python
import os
import uuid
import logging
from pathlib import Path

from flask import Flask, request
from werkzeug.utils import secure_filename

logging.basicConfig(format='%(asctime)s %(message)s', level=logging.INFO)
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50_000_000

ALLOWED_EXTENSIONS = {'txt', 'doc', 'docx', 'xls', 'xlsx', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg'}
UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', default='/uploads')
Path(UPLOAD_FOLDER).mkdir(parents=True, exist_ok=True)


@app.route('/upload', methods=['POST'])
def upload():
    app.logger.info('Handling new file upload: %s', request.files)
    if 'file' not in request.files:
        app.logger.error('file not found in request')
        return {'error': 'Can\'t find file to upload'}, 400
    file = request.files['file']
    if file.filename == '':
        app.logger.error('filename not found')
        return {'error': 'Can\'t find file to upload'}, 400
    if file and '.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS:
        filename = '{}-{}' .format(uuid.uuid4(), secure_filename(file.filename))
        app.logger.info('Storing new file %s', filename)
        file.save(os.path.join(UPLOAD_FOLDER, filename))
        app.logger.info('File {} stored', filename)
        return {'filename': filename}
    app.logger.error('Invalid filename %s', file.filename)
    return {'error': 'Invalid filename'}, 500


if __name__ == '__main__':
    app.run()
```

Pada kode program di atas, saya mendefinisikan sebuah `@app.route()` dengan method `POST` untuk menangani proses *upload*.  Saya akan `multiplart/form-data` yang umum dipakai untuk *upload* dimana nama elemen dengan nama `file` (yang bisa dibuat dengan menggunakan `{% raw %}<input type='file' name='file'>{% endraw %}`.  Karena nama file adalan *input* dari pengguna sehingga tidak dapat dipercaya, saya kemudian melakukan sanitasi nama file dengan menggunakan `secure_filename()` (untuk menghindari serangan yang menggunakan nama yang mengandung navigasi relatif seperti `../../../etc`).  Selain itu, saya juga menambahkan sebuah `uuid.uuid4()` sebagai awalan nama file supaya nama file sulit ditebak sekaligus juga menghindari masalah duplikasi bila file dengan nama yang sama di-*upload* lagi.  Terakhir, kode program di atas akan menyalin file ke folder `/uploads` dengan menggunakan `file.save()`.  Ia juga akan mengembalikan sebuah JSON yang mengandung informasi nama file yang ditulis.

Saya kemudian membuat sebuah [Dockerfile](https://github.com/JockiHendry/latihan-k8s/blob/71370d962bb44a7130ed7d0be556a161e9697535/file-upload-service/Dockerfile) untuk menjalankan kode program di atas di dalam *container* dengan isi seperti berikut ini:

```dockerfile
FROM alpine:3.15
EXPOSE 8080
WORKDIR /app
RUN apk add --no-cache uwsgi-python3 python3 cmd:pip3
COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt
COPY . .
RUN mkdir /uploads && chown uwsgi /uploads && chgrp uwsgi /uploads
CMD ["uwsgi", "--socket", "0.0.0.0:7070", "--protocol", "uwsgi", "--plugins", "python3", \
     "--wsgi-file", "app.py", "--callable", "app", "--uid", "uwsgi"]
```

Walaupun Flask sudah dilengkapi dengan *development server* yang dapat melayani HTTP langsung dengan perintah `flask run`, *server* tersebut tidak disarankan untuk produksi seperti yang dituliskan di <https://flask.palletsprojects.com/en/2.0.x/server/>.  Sebagai gantinya, Python memiliki standar Web Server Gateway Interface (WSGI) untuk *web server*.  Flask termasuk framework yang kompatibel dengan WSGI, sehingga saya bisa menggunakan *server* WSGI seperti `uwsgi`.  Pada `Dockerfile` di atas, saya menggunakan `--protocol uwsgi` dan `--socket` sehingga `uwsgi` tidak dapat diakses secara langsung sebagai *web server*, namun harus melalui *server* lain yang mendukung protokol uwsgi seperti NGINX.   

Untuk men-*build* `Dockerfile` tersebut di minikube, saya segera memberikan perintah berikut ini:

> <strong>$</strong> <code>eval $(minikube docker-env)</code>

> <strong>$</strong> <code>docker build -t file-upload-service .</code>

Untuk proses baca (*download*), saya tidak menggunakan Flask.  Sebagai gantinya, saya akan langsung mempublikasikan folder `/uploads` melalui NGINX tanpa melalui Python untuk mendapatkan kinerja terbaik.  Dengan demikian, *pod* untuk *service* ini akan terdiri atas dua *container*: satu untuk aplikasi Flask (Python) dan satu lagi untuk NGINX.  Dalam hal ini,  NGINX berperan sebagai *sidecar*, hampir sama seperti [Envoy](https://www.envoyproxy.io/) yang disuntikkan oleh Istio ke dalam *pod* untuk mengelola *container* utama di *pod* tersebut.

Kenapa saya memakai NGINX dan bukan Envoy?  Hal ini karena Envoy tidak mendukung fitur *web server* seperti melayani file statis, FastCGI, protokol uwsgi dan sebagainya.  Envoy memang dibuat murni untuk keperluan *service mesh* seperti *routing*, *rate limiting*, *authentication*, dan sejenisnya.  Hal tersebut justru kadang malah susah didapatkan di NGINX.  Sebagai contoh, untuk mendapatkan fasilitas validasi JWT di NGINX, saya harus memakai NGINX Plus sementara fitur ini sudah ada di Envoy tanpa biaya tambahan.

Saya kemudian membuat sebuah *manifest* Kubernetes dengan nama [file-upload-service.yaml](https://github.com/JockiHendry/latihan-k8s/blob/9efb697a556cc13f237c36246a60e0a27e99b7a9/kubernetes/file-upload-service.yaml) dengan isi seperti berikut ini:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: file-upload-service
  labels:
    app.kubernetes.io/name: file-upload-service
    app.kubernetes.io/component: app-server
    app.kubernetes.io/part-of: file-upload-service
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: file-upload-service
  serviceName: file-upload-service-headless
  template:
    metadata:
      labels:
        app.kubernetes.io/name: file-upload-service
        app.kubernetes.io/component: app-server
        app.kubernetes.io/part-of: file-upload-service
    spec:
      containers:
        - name: file-upload-service
          image: 'file-upload-service:latest'
          imagePullPolicy: Never
          livenessProbe:
            tcpSocket:
              port: 7070
          volumeMounts:
            - name: uploads
              mountPath: /uploads              
        - name: nginx
          image: nginx:1.21-alpine
          ports:
            - name: web
              containerPort: 8080
          volumeMounts:
            - name: nginx-config
              mountPath: /etc/nginx/conf.d
              readOnly: true
            - name: uploads
              mountPath: /uploads              
      volumes:
        - name: nginx-config
          configMap:
            name: file-upload-service-nginx-config
            items:
              - key: nginx.conf
                path: file-upload-service.conf
        - name: uploads
          emptyDir: {}
```

Pada konfigurasi di atas, tidak seperti biasanya yang menggunakan `Deployment`, kali ini saya menggunakan `StatefulSet`.  Salah satu perbedaan utama antara `StatefulSet` dan `Deployment` adalah bila *pod* mengalami masalah dan harus dibuat ulang, *pod* di `StatefulSet` tetap akan memiliki asosiasi terhadap *persistent volume* yang sama.  Selain itu, di `StatefulSet`, saya juga perlu menambahkan `serviceName` yang akan membuat sebuah *headless service*.  Kubernetes akan menambahkan nama seperti `<nama_pod>.<nama servicename>` di DNS untuk mengakses *pod* secara langsung dari luar.  Nama *pod* selalu diakhiri angka berurut seperti `file-upload-service-0`, `file-upload-service-1`, dan seterusnya.  Dengan demikian, *pod* dapat diakses dengan nama seperti `file-upload-service-0.file-upload-service-headless`, `file-upload-service-1.file-upload-service-headless`, dan seterusnya.

Walaupun kedua *container* ini berada dalam *pod* yang sama, mereka memiliki isi *"harddisk"* yang berbeda, tergantung dari *image* yang dipakai.   Agar bisa saling berkomunikasi, salah satu pola yang umum dipakai adalah dengan memakai `volumeMounts` yang sama.  Pada konfigurasi saya, folder `/uploads` akan selalu memiliki isi yang sama baik di *container* NGINX maupun di *container* Flask.  Dengan demikian, apa yang ditulis oleh *container* Flask dapat dilihat juga oleh *container* NGINX.

Untuk mempermudah pengaturan, saya meletakkan konfigurasi NGINX di dalam sebuah ConfigMap yang kemudian dirujuk melalui `configMap` di `volumes`.  Untuk mengisi nilai konfigurasi NGINX tersebut, saya menambahkan deklarasi berikut ini ke file *manifest* Kubernetes:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: file-upload-service-nginx-config
  labels:
    app.kubernetes.io/name: file-upload-service-nginx-config
    app.kubernetes.io/component: app-server
    app.kubernetes.io/part-of: file-upload-service
data:
  nginx.conf: |
    server {
      listen 8080;
      location /upload {
        uwsgi_pass 127.0.0.1:7070;
        include uwsgi_params;
      }
      location / {
        root /uploads;
        sendfile on;
        tcp_nopush on;
        aio on;
        limit_rate 1m;
        sendfile_max_chunk 1m;
      }
    }
```

Pada konfigurasi NGINX di atas, mendeklarasikan dua rute berbeda: 
* Rute `/upload` akan diteruskan ke aplikasi Flask melalui `uwsgi_pass`.  Karena berada dalam *pod* yang sama, saya dapat menggunakan `127.0.0.1` untuk mengatasi aplikasi Flask.  Port 7070 yang dipakai oleh *container* tersebut tidak perlu di-ekspos diluar *pod* karena tidak akan diakses secara langsung.
* Rute `/` untuk membaca file yang ada di folder `/uploads`.  Saya menggunakan `sendfile`, `tcp_nopush`, dan `aio` untuk mengoptimalkan proses *download* file statis tersebut.  Selain itu, saya juga menggunakan `limit_rate` supaya sebuah koneksi dari pengguna maksimal hanya 1 MB/s.  Batasan ini tidak berlaku bila pengguna membuka koneksi lain misalnya dengan membuka tab baru di browser.  Untuk membatasi jumlah koneksi berdasarkan alamat IP, saya bisa menggunakan `limit_conn addr`.  Saya juga dapat menggunakan `limit_rate_after` untuk membatasi kecepatan hanya bila pengguna sudah men-*download* lebih dari batas yang saya tentukan.

Dan sebagai langkah terakhir, saya akan mempublikasikan *service* dengan menambahkan deklarasi berikut ini ke file *manifest* Kubernetes:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: file-upload-service
  labels:
    app.kubernetes.io/name: file-upload-service
    app.kubernetes.io/component: app-server
    app.kubernetes.io/part-of: file-upload-service
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: file-upload-service
  ports:
    - name: http
      port: 8080
```

Bila memakai *ingress controller*, saya perlu menambahkan *rule* baru di [ingress-api.yaml](https://github.com/JockiHendry/latihan-k8s/blob/9efb697a556cc13f237c36246a60e0a27e99b7a9/kubernetes/ingress-api.yaml) seperti yang terlihat pada cuplikan berikut ini:

```yaml
  - path: /files/(.*)
    pathType: Prefix
    backend:
      service:
        name: file-upload-service
        port:
          number: 8080
```

Saya bisa menerapkan perubahan dengan memberikan perintah berikut ini:

> <strong>$</strong> <code>kubectl apply -f file-upload-service.yaml</code>

> <strong>$</strong> <code>kubectl apply -f ingress-api.yaml</code>

Sekarang, saya bisa menyimpan file baru ke *backend*, misalnya dengan perintah berikut ini:

> <strong>$</strong> <code>curl -F "file=@gambar.png;type=image/png" https://api.latihan.jocki.me/files/upload</code>

```json
{"filename":"c44eb6e0-2c3e-4e22-b379-a3565216fc3b-gambar.png"}
```

Terlihat bahwa file berhasil ditulis di folder `uploads`.  Bila saya membuka URL https://api.latihan.jocki.me/files/c44eb6e0-2c3e-4e22-b379-a3565216fc3b-gambar.png di browser, saya akan menemukan gambar yang barusan saya upload tersebut.  Dengan demikian fitur *upload* dan *download* sudah bekerja dengan baik.   Namun masih ada satu masalah: penyimpanannya tidak permanen!  Untuk membuktikannya, saya akan menghapus *pod* dengan memberikan perintah berikut ini:

> <strong>$</strong> <code>kubectl delete pod file-upload-service-0</code>

Karena *pod* dikelola oleh StatefulSet,  tidak lama kemudian *pod* baru dengan nama yang sama akan dibuat ulang.  Bila saya mencoba membuka https://api.latihan.jocki.me/files/c44eb6e0-2c3e-4e22-b379-a3565216fc3b-gambar.png di browser, kali ini saya akan menemukan pesan kesalahan 404 Not Found.  Ini menunjukkan bahwa penyimpanan di *pod* bersifat sementara dan file tersebut kini sudah hilang.

Untuk memakai penyimpanan permanen, langkah pertama yang harus saya lakukan adalah mendeklarasikan sebuah Persistent Volume.  Kubernetes mendukung cukup banyak jenis Persistent Volume seperti AWS Elastic Block Store, Azure Disk, GCE Persistent Disk, Network File Storage (NFS), dan sebagainya.  Pada latihan kali ini, saya akan memakai yang paling sederhana, yaitu `local` yang akan menggunakan *storage* yang tersedia di *node* Kubernetes secara langsung.  Untuk hasil yang handal dengan kinerja penyimpanan yang lebih baik, *administrator* dapat menggabungkan beberapa komputer yang memiliki penyimpanan optimal (misalnya PC dengan SSD yang terpasang di slot M.2 dengan bus PCIe 4.0) menjadi sebuah *storage server* yang berdiri sendiri (bukan bagian *cluster* Kubernetes).  *Storage server* ini nantinya dapat diakses melalui NFS di Kubernetes.

Namun karena menggunakan `local`, saya hanya perlu membuat sebuah folder baru di salah satu *node* yang merupakan bagian dari *cluster* Kubernetes.  minikube sendiri sudah menyediakan sebuah folder di `/data` yang isi-nya tidak akan hilang setelah komputer di-*restart*.  Ini adalah lokasi yang tepat untuk dipakai sebagai Persistent Volume `local`. 

Karena folder `/data` sudah ada di *node* yang dibuat oleh minikube, saya hanya perlu menambahkan konfigurasi baru seperti berikut ini:

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: file-upload-storage
spec:
  capacity:
    storage: 100Mi
  volumeMode: Filesystem
  accessModes:
    - ReadWriteOnce
  storageClassName: local-storage
  local:
    path: /data
  nodeAffinity:
    required:
      nodeSelectorTerms:
        - matchExpressions:
            - key: kubernetes.io/hostname
              operator: In
              values:
                - minikube
```

Konfigurasi di atas akan membuat sebuah PersistentVolume dengan ukuran 100MB (berdasarkan isi nilai `capacity`) yang disimpan di *node* `minikube` (berdasarkan isi nilai `nodeAffinity`) di folder `/data` (berdasarkan isi nilai `path`).  Saya kemudian menerapkan perubahan baru tersebut dengan memberikan perintah:

> <strong>$</strong> <code>kubectl apply -f file-upload-service.yaml</code>

> <strong>$</strong> <code>kubectl get pv</code>

```
NAME                   CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS      CLAIM      STORAGECLASS    REASON   AGE
file-upload-storage    100Mi      RWO            Retain           Available              local-storage            91s
```

Status Persistent Volume saat ini masih `Available` karena belum ada yang memakainya.  Untuk memakai Persistent Volume, saya perlu membuat sebuah Persistent Volume Claim.  Sebagai contoh, saya dapat mendefinisikannya dengan konfigurasi seperti berikut ini:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: file-upload-storage-claim
spec:
  accessModes:
    - ReadWriteOnce
  volumeMode: Filesystem
  resources:
    requests:
      storage: 100Mi
  storageClassName: local-storage
```

Saya kemudian mengaplikasikannya dengan memberikan perintah:

> <strong>$</strong> <code>kubectl apply -f file-upload-service.yaml</code>

> <strong>$</strong> <code>kubectl get pvc</code>

```
NAME                         STATUS   VOLUME                  CAPACITY   ACCESS MODES   STORAGECLASS    AGE
file-upload-storage-claim    Bound    file-upload-storage     100Mi      RWO            local-storage   4s
```

Karena satu-satunya Persistent Volume yang tersedia saat ini hanya `file-upload-storage`, Persistent Volume Claim yang barusan saya buat akan mendapatkan Persistent Volume tersebut.  Bila ada beberapa Persistent Volume lain yang memenuhi kriteria penyimpanan Persistent Volume Claim tersebut, Kubernetes akan memilih salah satu yang terbaik.  Selain itu, untuk jenis Persistent Volume tertentu, terdapat fitur *dynamic provisioning* yang dapat secara otomatis membuat Persistent Volume baru sesuai dengan yang ukuran yang diminta oleh Persistent Volume Claim.

Untuk memakai PersistentVolumeClaim tersebut, saya akan mengubah definisi `volumes` yang dari seperti:

```yaml
...
  volumes:
    ...
    - name: uploads
      emptyDir: {}
...
```

menjadi seperti:

```yaml
...
spec:
  ...
  template:
    ...
    spec:
      securityContext:
        fsGroup: 1001
    containers:
      - name: file-upload-service
        ...
        securityContext:
          runAsNonRoot: true
          runAsUser: 1001
        ...
      ...
    volumes:
      ...
      - name: uploads
        persistentVolumeClaim:
          claimName: file-upload-storage-claim
```

Saya perlu menggunakan `securityContext` agar Persistent Volume memiliki hak akses sesuai dengan user id yang menjalankan aplikasi.  Bila tidak, Persistent Volume akan di-*mount* sebagai milik `root` sehingga aplikasi yang tidak dijalankan oleh user `root` tidak akan bisa membaca dan menulis ke folder tersebut.

Untuk mengaplikasikan perubahan, saya memberikan perintah berikut ini

> <strong>$</strong> <code>kubectl apply -f file-upload-service.yaml</code>

Sekarang, bila saya menghapus *pod*, file yang telah di-*upload* tetap akan ada karena mereka kini berada di sebuah Persistent Volume.  Bahkan, karena nilai `persistentVolumeReclaimPolicy` secara *default* adalah `Retain`, setelah saat Persistent Volume Claim dan StatefulSet dihapus, Persistent Volume **tidak** akan ikut dihapus.  Sebagai gantinya, status dari Persistent Volume tersebut berubah menjadi `Retain`.  Saat berada di status ini, ia tidak akan bisa dipakai oleh Persistent Volume Claim manapun.  Dengan demikian, bila menemukan Persistent Volume dengan status `Retain`, saya perlu meninjau ulang isi file, melakukan *backup*, atau operasi lainnya (misalnya dengan `kubectl cp`).  Setelah selesai, saya dapat menghapusnya secara manual dengan memberikan perintah seperti <code>kubectl delete pv file-upload-storage</code>.