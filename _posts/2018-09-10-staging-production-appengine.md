---
layout: post
category: DevOps
title: Staging dan Production Dengan Konfigurasi Berbeda Di Proyek App Engine Yang Sama
tags: [AppEngine]
---

Saya sedang mengerjakan sebuah proyek yang di-*deploy* secara otomatis melalui *Continuous Integration (CI) pipeline* ke dua proyek Google App Engine yang berbeda.  *Deployment* pertama akan dipakai untuk keperluan *staging*.  Setelah fitur  di *staging* ini diuji menyeluruh oleh manusia, CI akan men-*deploy* kode program yang sama persis ke proyek Google App Engine lainnya.  Proyek kedua ini akan diakses oleh publik (disebut juga *production*).

Salah satu kelebihan App Engine *standard* environment adalah biayanya yang murah.  Bila tidak ada pengguna yang mengakses aplikasi, maka tidak ada tagihan yang perlu dibayar.  Pada konfigurasi *default*, App Engine secara otomatis akan mematikan *instance* bila tidak ada yang memakai aplikasi.  Saat ada pengguna yang membuka aplikasi, App Engine secara otomatis akan membuat *instance* baru.

Walaupun demikian, untuk aplikasi App Engine yang ditulis dengan menggunakan Spring Boot (Java), waktu yang dibutuhkan untuk membuat *instance* baru bisa cukup lama (hingga setengah menit).  Hal ini akan membuat pengguna yang sedang tidak beruntung, yang mengakses aplikasi pada saat tidak ada *instance* yang menyala, menunggu lebih lama dari biasanya.  Oleh sebab itu, akan lebih baik bila pada server *production* terdapat minimal satu *instance*.  Sementara itu, server *staging* boleh dibiarkan tetap otomatis agar menghemat biaya.  Membuat *instance* agar selalu menyala dapat dilakukan dengan mengubah `appengine-web.xml` pada nilai `min-instances` menjadi minimal `1`.

Pertanyaannya adalah bagaimana supaya pada proyek yang sama dengan kode program yang sama memiliki nilai `appengine-web.xml` yang berbeda di server yang berbeda?  Saat ini belum ada fasilitas bawaan App Engine untuk kebutuhan ini.  Akan tetapi, saya bisa menggunakan fitur *build profiles* dari Maven.  Saya bisa menambahkan bagian seperti berikut ini pada `pom.xml`:

```xml
...
<profiles>
    <profile>
        <id>staging</id>
        <activation>
            <activeByDefault>true</activeByDefault>
        </activation>
        <properties>
            <env>staging</env>
        </properties>
    </profile>
    <profile>
        <id>prod</id>
        <activation>
            <property>
                <name>env</name>
                <value>prod</value>
            </property>
        </activation>
        <properties>
            <env>prod</env>
        </properties>
    </profile>
</profiles>
...
```

Pada konfigurasi di atas, *build environment* `staging` akan aktif secara default.  Untuk mengaktifkan *build environment* `prod`, saya bisa menambahkan argumen `-Denv=prod`.

Berikutnya, saya membuat dua folder baru di `src/main/webapp/WEB-INF` dengan nama `staging` dan `prod`. Masing-masing folder tersebut memiliki file `appengine-web.xml` mereka.  File konfigurasi di folder `staging` sama seperti yang sekarang saya pakai.  Sementara itu, file konfigurasi di folder `prod` mengandung konfigurasi `min-instances` minimal `1`.

Selain itu, saya juga membiarkan file `src/main/webapp/WEB-INF/appengine-web.xml` tanpa dihapus.  Hal ini karena saya menggunakan plugin Cloud Tools for IntelliJ.  Saya merasa dengan plugin ini, *unit test* berjalan jauh lebih cepat dibandingkan dengan memanggilnya melalui Maven. File `src/main/webapp/WEB-INF/appengine-web.xml` tetap harus ada bila saya ingin menjalankan aplikasi dari IntelliJ seperti pada gambar berikut ini:

![Launcher App Engine di IntelliJ]({{ "/assets/images/gambar_00018.png" | relative_url}}){:class="img-fluid rounded"}

Dengan demikian, saya kini memiliki 3 file `appengine-web.xml`: untuk keperluan lokal (dijalankan tanpa Maven melalui Cloud Tools for IntelliJ), *staging* dan *production*.

Sebagai langkah terakhir, saya melakukan perubahan pada plugin `maven-war-plugin` di `pom.xml` sehingga terlihat seperti berikut ini:

```xml
...
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-war-plugin</artifactId>
    <version>3.2.2</version>
    <configuration>
        <resources>
            <resource>
                <directory>src/main/webapp/WEB-INF</directory>
                <excludes>
                    <exclude>appengine-web.xml</exclude>
                </excludes>
                <filtering>false</filtering>
            </resource>
        </resources>
        <failOnMissingWebXml>false</failOnMissingWebXml>
        <webResources>
            <resource>
                <targetPath>WEB-INF</targetPath>
                <directory>src/main/webapp/WEB-INF/${env}</directory>
            </resource>
        </webResources>
    </configuration>
</plugin>
...

```

Pada konfigurasi di atas, saya menambahkan `webResources` untuk men-copy file `appengine-web.xml` dari folder `staging` atau `production`.  Selain itu, karena file `appengine-web.xml` di lokasi tujuan sudah ada, saya perlu menambahkan `<exclude>` di `<resource>`.  Bila bagian ini tidak ada, plugin `maven-war-plugin` tidak akan menimpa `appengine-web.xml` dengan yang berada di folder `staging` atau `production`.

Sekarang, saya hanya perlu mengubah perintah pada *CI pipeline* untuk *deployment* ke *staging* sehingga terlihat seperti berikut ini:

```
mvn appengine:deploy -Denv=staging
```

dan perintah *CI pipeline* untuk *deployment* ke *production* menjadi seperti:

```
mvn appengine:deploy -Denv=prod
```

Sekarang, bila saya ingin memiliki pengaturan lainnya untuk App Engine yang berbeda antara *staging* dan *production*, saya bisa mengubah file `appengine-web.xml` di folder yang sesuai.  *Pipeline CI* akan melakukan *deployment* secara otomatis dengan menggunakan file yang benar.