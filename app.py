from flask import Flask, render_template, url_for

app = Flask(__name__)

videos = [
    "videos/art009.mp4",
    "videos/art014.mp4",
    "videos/art0010.mp4",
    "videos/art0006.mp4",
    "videos/art003.mp4"
]

@app.route("/")
def home():
    data = [url_for("static", filename=v) for v in videos]
    return render_template("index.html", videos=data)

#about
@app.route("/about")
def about():
    return render_template("about.html")

# NEW ROUTE
@app.route("/dither")
def dither():
    return render_template("dither.html")

if __name__ == "__main__":
    app.run(debug=True)