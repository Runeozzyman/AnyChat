from flask import Flask, render_template, request, redirect, url_for
from flask_socketio import SocketIO, join_room, leave_room, send
import uuid

#TODO------------------------------------------------------------
#1: Add timestamps to messages
#2: Add typing indicators
#3: Add user profile pictures
#4: Add chat timer

app = Flask(__name__)
app.config['SECRET_KEY'] = "secret"
socketio = SocketIO(app, cors_allowed_origins="*")

# Store waiting users and room mappings
waiting_users = []   # queue [(sid, nickname)]
user_rooms = {}      # sid -> room

@app.route('/')
def landing():
    return render_template("landing.html")

@app.route('/chat', methods=["POST"])  # must allow POST from form
def chat():
    nickname = request.form.get("nickname")
    if not nickname:
        return redirect(url_for("landing"))
    # nickname gets passed into chat.html
    return render_template("chat.html", nickname=nickname)

@socketio.on("join")
def handle_join(data):
    sid = request.sid
    nickname = data.get("nickname")

    if not waiting_users:
        # no one waiting → put user in queue
        waiting_users.append((sid, nickname))
        send("⏳ Waiting for another user to join...", to=sid)
    else:
        # someone waiting → pair them
        other_sid, other_nick = waiting_users.pop(0)
        room_id = str(uuid.uuid4())[:8]

        # join both users to the room
        join_room(room_id, sid)
        join_room(room_id, other_sid)

        user_rooms[sid] = room_id
        user_rooms[other_sid] = room_id

        # notify both
        send(f"✅ You are now chatting with {other_nick}", to=sid)
        send(f"✅ You are now chatting with {nickname}", to=other_sid)

@socketio.on("message")
def handle_message(msg):
    sid = request.sid
    room = user_rooms.get(sid)
    if room:
        send(msg, to=room)

@socketio.on("disconnect")
def handle_disconnect():
    sid = request.sid

    # if user was waiting, remove them
    for i, (qsid, _) in enumerate(waiting_users):
        if qsid == sid:
            waiting_users.pop(i)
            break

    # if user was paired, notify the other
    if sid in user_rooms:
        room = user_rooms[sid]
        send("⚠️ The other user disconnected.", to=room)
        leave_room(room, sid)
        del user_rooms[sid]

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
