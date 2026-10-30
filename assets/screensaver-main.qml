/*
 * Zachtlicht, het scherm dat LG toont na bind-mount op
 * /usr/palm/applications/com.webos.app.screensaver/qml/main.qml
 *
 * Test: luna-send -n 1 'luna://com.webos.service.tvpower/power/turnOnScreenSaver' '{}'
 */
import QtQuick 2.4
import Eos.Window 0.1
import QtQuick.Window 2.2

WebOSWindow {
    id: window

    width: 1920
    height: 1080
    windowType: "_WEBOS_WINDOW_TYPE_SCREENSAVER"
    color: "black"
    title: "Screensaver"
    appId: "com.webos.app.screensaver"
    visible: true

    Item {
        id: root
        anchors.fill: parent

        property int imageSize: 640
        property real veil: 0.45
        property int durationSec: 90
        property int durationMs: 90000
        property var works: []
        property int index: 0
        property int pass: 0
        property string pending: ""
        property bool showingA: true
        property bool hasShown: false
        property int misses: 0
        property bool fadeArmed: false
        property string settingsPath: "/var/lib/webosbrew/zachtlicht/settings.json"
        property string playlistPath: "/var/lib/webosbrew/zachtlicht/playlist.json"

        function pickVeil(value) {
            var options = [0.25, 0.45, 0.65];
            var i;
            for (i = 0; i < options.length; i++) {
                if (Math.abs(options[i] - Number(value)) < 0.02)
                    return options[i];
            }
            return 0.45;
        }

        function applySettings(data) {
            var size = parseInt(data.imageSize, 10);
            if (size !== 320 && size !== 640 && size !== 960)
                size = 640;
            root.imageSize = size;
            root.veil = root.pickVeil(data.veil);
            var duration = parseInt(data.durationSec, 10);
            if (duration !== 45 && duration !== 90 && duration !== 180)
                duration = 90;
            root.durationSec = duration;
            root.durationMs = duration * 1000;
        }

        function loadJson(filePath, done) {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "file://" + filePath);
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== XMLHttpRequest.DONE)
                    return;
                if ((xhr.status !== 200 && xhr.status !== 0) || !xhr.responseText) {
                    done(null);
                    return;
                }
                try {
                    done(JSON.parse(xhr.responseText));
                } catch (error) {
                    done(null);
                }
            };
            xhr.send();
        }

        function showCaption() {
            var work = root.works[root.index];
            if (!work)
                return;
            captionTitle.text = work.title || "Zonder titel";
            var meta = work.artist || "";
            if (work.year)
                meta = meta ? meta + "  ·  " + work.year : work.year;
            captionMeta.text = meta;
            captionMeta.visible = meta !== "";
            captionCredit.text = work.credit || "";
            captionCredit.visible = captionCredit.text !== "";
            captionBox.opacity = 0;
            captionAnim.restart();
        }

        function startDrift(which) {
            var frame = which === "a" ? frameA : frameB;
            var layer = which === "a" ? layerA : layerB;
            var xAnim = which === "a" ? driftAX : driftBX;
            var yAnim = which === "a" ? driftAY : driftBY;
            var sAnim = which === "a" ? driftAS : driftBS;
            var anim = which === "a" ? driftA : driftB;
            var sign = ((root.index + root.pass) % 2 === 0) ? 1 : -1;
            var layerWidth = layer.width > 0 ? layer.width : 1920;
            var layerHeight = layer.height > 0 ? layer.height : 1080;
            var baseX = (layerWidth - frame.width) / 2;
            var baseY = (layerHeight - frame.height) / 2;
            xAnim.from = baseX;
            xAnim.to = baseX + (36 * sign);
            yAnim.from = baseY;
            yAnim.to = baseY - (24 * sign);
            sAnim.from = 1.0;
            sAnim.to = 1.06;
            xAnim.duration = root.durationMs;
            yAnim.duration = root.durationMs;
            sAnim.duration = root.durationMs;
            frame.x = baseX;
            frame.y = baseY;
            frame.scale = 1;
            anim.restart();
        }

        function beginHold(which) {
            root.startDrift(which);
            root.showCaption();
            holdTimer.restart();
        }

        function finishFade(which) {
            if (!root.fadeArmed)
                return;
            root.fadeArmed = false;
            root.showingA = which === "a";
            if (which === "a") {
                layerA.opacity = 1;
                layerB.opacity = 0;
            } else {
                layerA.opacity = 0;
                layerB.opacity = 1;
            }
            root.beginHold(which);
        }

        function loadPending() {
            if (root.pending !== "a" && root.pending !== "b")
                return;
            if (!root.works || !root.works.length)
                return;
            var work = root.works[root.index];
            if (!work || !work.image) {
                root.skipBroken();
                return;
            }
            var image = root.pending === "a" ? imageA : imageB;
            image.source = work.image;
        }

        function skipBroken() {
            root.misses = root.misses + 1;
            if (!root.works || !root.works.length || root.misses > root.works.length) {
                root.pending = "";
                return;
            }
            root.index = (root.index + 1) % root.works.length;
            skipTimer.restart();
        }

        function onImageStatus(which) {
            if (root.pending !== which)
                return;
            var image = which === "a" ? imageA : imageB;
            if (image.status === Image.Error) {
                root.skipBroken();
                return;
            }
            if (image.status !== Image.Ready)
                return;
            root.pending = "";
            root.misses = 0;
            if (!root.hasShown) {
                root.hasShown = true;
                root.showingA = true;
                firstFade.start();
                root.beginHold("a");
                return;
            }
            root.fadeArmed = true;
            if (which === "a")
                fadeToA.start();
            else
                fadeToB.start();
        }

        function requestNext() {
            if (!root.works || !root.works.length)
                return;
            if (root.works.length === 1) {
                root.pass = root.pass + 1;
                root.beginHold(root.showingA ? "a" : "b");
                return;
            }
            root.index = (root.index + 1) % root.works.length;
            var which = root.showingA ? "b" : "a";
            var layer = which === "a" ? layerA : layerB;
            var frame = which === "a" ? frameA : frameB;
            layer.opacity = 0;
            frame.scale = 1;
            root.pending = which;
            root.misses = 0;
            root.loadPending();
        }

        function startShow() {
            if (!root.works || !root.works.length)
                return;
            root.index = 0;
            root.misses = 0;
            root.hasShown = false;
            root.pending = "a";
            root.loadPending();
        }

        Component.onCompleted: {
            root.loadJson(root.settingsPath, function (data) {
                if (data)
                    root.applySettings(data);
                root.loadJson(root.playlistPath, function (list) {
                    if (list && list.items && list.items.length)
                        root.works = list.items;
                    root.startShow();
                });
            });
        }

        Rectangle {
            anchors.fill: parent
            color: "black"
        }

        Item {
            id: layerA
            anchors.fill: parent
            opacity: 0
            clip: true

            Item {
                id: frameA
                width: parent.width * 1.16
                height: parent.height * 1.16
                transformOrigin: Item.Center

                Image {
                    id: imageA
                    anchors.fill: parent
                    fillMode: Image.PreserveAspectCrop
                    smooth: true
                    asynchronous: true
                    sourceSize.width: root.imageSize
                    onStatusChanged: root.onImageStatus("a")
                }
            }
        }

        Item {
            id: layerB
            anchors.fill: parent
            opacity: 0
            clip: true

            Item {
                id: frameB
                width: parent.width * 1.16
                height: parent.height * 1.16
                transformOrigin: Item.Center

                Image {
                    id: imageB
                    anchors.fill: parent
                    fillMode: Image.PreserveAspectCrop
                    smooth: true
                    asynchronous: true
                    sourceSize.width: root.imageSize
                    onStatusChanged: root.onImageStatus("b")
                }
            }
        }

        Rectangle {
            anchors.fill: parent
            color: "black"
            opacity: root.veil
        }

        Item {
            id: captionBox
            opacity: 0
            width: 1000
            anchors.left: parent.left
            anchors.bottom: parent.bottom
            anchors.leftMargin: 72
            anchors.bottomMargin: 64

            Rectangle {
                anchors.fill: captionColumn
                anchors.leftMargin: -28
                anchors.rightMargin: -28
                anchors.topMargin: -20
                anchors.bottomMargin: -20
                color: "#000000"
                opacity: 0.45
                radius: 8
            }

            Column {
                id: captionColumn
                width: parent.width
                spacing: 8

                Text {
                    id: captionTitle
                    width: parent.width
                    color: "#f4efe6"
                    font.pixelSize: 36
                    wrapMode: Text.WordWrap
                }

                Text {
                    id: captionMeta
                    width: parent.width
                    color: "#e4d8c4"
                    font.pixelSize: 26
                    wrapMode: Text.WordWrap
                }

                Text {
                    id: captionCredit
                    width: parent.width
                    color: "#c8bba6"
                    font.pixelSize: 22
                    wrapMode: Text.WordWrap
                }
            }
        }

        Timer {
            id: holdTimer
            interval: root.durationMs
            repeat: false
            onTriggered: root.requestNext()
        }

        Timer {
            id: skipTimer
            interval: 1
            repeat: false
            onTriggered: root.loadPending()
        }

        NumberAnimation {
            id: firstFade
            target: layerA
            property: "opacity"
            from: 0
            to: 1
            duration: 800
        }

        ParallelAnimation {
            id: fadeToB
            NumberAnimation { target: layerA; property: "opacity"; to: 0; duration: 2000 }
            NumberAnimation { target: layerB; property: "opacity"; to: 1; duration: 2000 }
            onStopped: root.finishFade("b")
        }

        ParallelAnimation {
            id: fadeToA
            NumberAnimation { target: layerA; property: "opacity"; to: 1; duration: 2000 }
            NumberAnimation { target: layerB; property: "opacity"; to: 0; duration: 2000 }
            onStopped: root.finishFade("a")
        }

        ParallelAnimation {
            id: driftA
            NumberAnimation { id: driftAX; target: frameA; property: "x"; easing.type: Easing.InOutQuad }
            NumberAnimation { id: driftAY; target: frameA; property: "y"; easing.type: Easing.InOutQuad }
            NumberAnimation { id: driftAS; target: frameA; property: "scale"; easing.type: Easing.InOutQuad }
        }

        ParallelAnimation {
            id: driftB
            NumberAnimation { id: driftBX; target: frameB; property: "x"; easing.type: Easing.InOutQuad }
            NumberAnimation { id: driftBY; target: frameB; property: "y"; easing.type: Easing.InOutQuad }
            NumberAnimation { id: driftBS; target: frameB; property: "scale"; easing.type: Easing.InOutQuad }
        }

        SequentialAnimation {
            id: captionAnim
            NumberAnimation { target: captionBox; property: "opacity"; to: 1; duration: 1500 }
            PauseAnimation { duration: 8000 }
            NumberAnimation { target: captionBox; property: "opacity"; to: 0; duration: 1500 }
        }
    }
}
