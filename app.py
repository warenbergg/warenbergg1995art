from flask import Flask, render_template, url_for
import os

app = Flask(__name__)

videos = [
    "https://res.cloudinary.com/dru9omgli/video/upload/v1769524131/art014_yisenx.mp4",
    "https://res.cloudinary.com/dru9omgli/video/upload/v1769524095/art0006_v6ylxa.mp4",
    "https://res.cloudinary.com/dru9omgli/video/upload/v1769524090/art009_hjabtl.mp4",
    "https://res.cloudinary.com/dru9omgli/video/upload/v1769524085/art0010_wixnse.mp4",
    "https://res.cloudinary.com/dru9omgli/video/upload/v1769524040/art003_zn5tpf.mp4"
]

@app.route("/")
def home():
    data = [url_for("static", filename=v) for v in videos]
    return render_template("index.html", videos=videos)

#about
@app.route("/about")
def about():
    return render_template("about.html")

# NEW ROUTE
@app.route("/dither")
def dither():
    return render_template("dither.html")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
