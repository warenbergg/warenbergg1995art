# 🎨 Waren Bergg Art — Flask Web Project

Website portofolio seni & eksperimen visual berbasis **Flask**.
Project ini berisi karya visual, animasi, dan video art yang ditampilkan melalui web.

---

## 🚀 Features

* 🖼️ Galeri artwork (gambar & video)
* 🎥 Dukungan video (MP4)
* 🎨 Desain visual eksperimental
* ⚙️ Backend ringan menggunakan Flask
* 🧪 Mode development dengan auto-reload

---

## 🧩 Tech Stack

* **Python 3**
* **Flask**
* **HTML / CSS / JavaScript**
* **Git & GitHub**
* *(Opsional)* Git LFS untuk file besar

---

## 📁 Project Structure

```
warenbergg1995art/
├── app.py
├── run.sh
├── requirements.txt
├── static/
│   ├── images/
│   ├── videos/
│   └── css/
├── templates/
│   └── index.html
├── venv/
└── README.md
```

---

## ▶️ Run Project (Once Click)

### Mac / Linux

```bash
./run.sh
```

### Manual

```bash
source venv/bin/activate
flask run
```

Buka di browser:

```
http://127.0.0.1:5000
```

---

## 🔄 Update Project ke GitHub

Setiap kali kamu:

* menambah / menghapus foto
* mengganti video
* mengedit kode

Jalankan:

```bash
git status
git add .
git commit -m "update artwork & layout"
git push
```

---

## 📦 Large Files (Video)

Project ini menggunakan file video berukuran besar.
Disarankan memakai **Git Large File Storage (Git LFS)**:

```bash
git lfs install
git lfs track "static/videos/*.mp4"
```

---

## 👤 Author

**Waren Bergg**
Visual Artist & Creative Coder

* GitHub: [https://github.com/warenbergg](https://github.com/warenbergg)

---

## 📝 License

This project is for personal & artistic use.

© 2025 Waren Bergg
