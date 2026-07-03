(function() {
    const PLACEHOLDER_COVER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%2366ccff'/%3E%3Cstop offset='0.52' stop-color='%23315aff'/%3E%3Cstop offset='1' stop-color='%23ff6f9f'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='600' height='600' fill='url(%23g)'/%3E%3Cpath d='M334 142v206c-18-14-42-22-70-22-58 0-104 34-104 76s46 76 104 76 104-34 104-76V212h90v-70H334z' fill='white' fill-opacity='.86'/%3E%3C/svg%3E";

    const root = document.documentElement;
    const body = document.body;
    const audio = document.getElementById("tyAudioPlayer");
    const coverImg = document.getElementById("tyCoverImg");
    const trackTitle = document.getElementById("tyTrackTitle");
    const trackArtist = document.getElementById("tyTrackArtist");
    const playPauseBtn = document.getElementById("tyPlayPauseBtn");
    const heroPlayBtn = document.getElementById("tyHeroPlayBtn");
    const footerPlayBtn = document.getElementById("tyFooterPlayBtn");
    const prevBtn = document.getElementById("tyPrevBtn");
    const nextBtn = document.getElementById("tyNextBtn");
    const seekSlider = document.getElementById("tySeekSlider");
    const volumeSlider = document.getElementById("tyVolumeSlider");
    const currentTimeSpan = document.getElementById("tyCurrentTime");
    const durationSpan = document.getElementById("tyDurationTime");
    const playlistContainer = document.getElementById("tyPlaylistContainer");
    const playlistCount = document.getElementById("tyPlaylistCount");
    const visualizer = document.getElementById("tyVisualizer");
    const marqueeTrack = document.getElementById("tyMarqueeTrack");
    const miniCovers = document.getElementById("tyMiniCovers");
    const accordionStack = document.getElementById("tyAccordionStack");
    const trackMetric = document.getElementById("tyTrackMetric");
    const navStatus = document.getElementById("tyNavStatus");

    let tracks = [];
    let currentTrackIndex = 0;
    let isSeeking = false;
    let audioContext = null;
    let analyser = null;
    let mediaSource = null;
    let frequencyData = null;
    let motionFrame = null;

    function formatTime(seconds) {
        if (Number.isNaN(seconds) || seconds < 0) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
    }

    function cssUrl(path) {
        const value = path ? new URL(path, window.location.href).href : PLACEHOLDER_COVER;
        return `url("${value.replace(/"/g, "%22")}")`;
    }

    function setRangeFill(input, percent) {
        const value = Math.max(0, Math.min(100, percent));
        input.style.setProperty("--range-value", `${value}%`);
    }

    function buildVisualizer() {
        visualizer.innerHTML = "";
        for (let i = 0; i < 28; i += 1) {
            const bar = document.createElement("span");
            bar.style.setProperty("--i", i);
            bar.style.setProperty("--level", 0.18 + ((i % 5) * 0.06));
            visualizer.appendChild(bar);
        }
    }

    function updatePlayPauseIcon(isPlaying) {
        const icons = [
            playPauseBtn.querySelector("i"),
            heroPlayBtn.querySelector("i"),
            footerPlayBtn.querySelector("i")
        ];

        icons.forEach(icon => {
            if (!icon) return;
            icon.classList.toggle("fa-play", !isPlaying);
            icon.classList.toggle("fa-pause", isPlaying);
        });

        heroPlayBtn.querySelector("span").textContent = isPlaying ? "暂停播放" : "开始播放";
        footerPlayBtn.querySelector("span").textContent = isPlaying ? "暂停当前歌曲" : "播放当前歌曲";
        body.classList.toggle("ty-playing", isPlaying);
        navStatus.textContent = isPlaying ? "播放中" : "待播放";
    }

    function updateAmbient(track) {
        const cover = track && track.cover ? track.cover : "";
        root.style.setProperty("--ty-cover", cssUrl(cover));
        document.title = track && track.title ? `${track.title} | 洛天依博客音乐台` : "洛天依博客音乐台";
    }

    function highlightCurrentItem(index) {
        document.querySelectorAll(".tianyi-list-item").forEach((item, i) => {
            item.classList.toggle("active", i === index);
        });
    }

    function updateMediaSession(track) {
        if (!("mediaSession" in navigator) || !window.MediaMetadata || !track) return;
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: track.artist,
            artwork: track.cover ? [{ src: track.cover, sizes: "512x512", type: "image/jpeg" }] : []
        });
        navigator.mediaSession.setActionHandler("previoustrack", prevTrack);
        navigator.mediaSession.setActionHandler("nexttrack", nextTrack);
        navigator.mediaSession.setActionHandler("play", playCurrent);
        navigator.mediaSession.setActionHandler("pause", pauseCurrent);
    }

    function loadTrack(index) {
        if (!tracks.length || index < 0 || index >= tracks.length) return;
        const track = tracks[index];

        coverImg.onerror = function() {
            coverImg.onerror = null;
            coverImg.src = PLACEHOLDER_COVER;
        };
        coverImg.src = track.cover || PLACEHOLDER_COVER;
        trackTitle.textContent = track.title || "未知标题";
        trackArtist.textContent = track.artist || "未知艺术家";
        audio.src = track.src;
        audio.load();
        seekSlider.value = 0;
        setRangeFill(seekSlider, 0);
        currentTimeSpan.textContent = "0:00";
        durationSpan.textContent = "0:00";
        highlightCurrentItem(index);
        updateAmbient(track);
        updateMediaSession(track);
        updatePlayPauseIcon(false);
    }

    function createThumb(src, alt) {
        const image = document.createElement("img");
        image.src = src || PLACEHOLDER_COVER;
        image.alt = alt || "";
        image.onerror = function() {
            image.onerror = null;
            image.src = PLACEHOLDER_COVER;
        };
        return image;
    }

    function renderPlaylist() {
        playlistContainer.innerHTML = "";
        playlistCount.textContent = `${tracks.length} 首`;
        trackMetric.textContent = tracks.length;

        if (!tracks.length) {
            const empty = document.createElement("li");
            empty.className = "tianyi-empty";
            empty.textContent = "暂无歌曲";
            playlistContainer.appendChild(empty);
            return;
        }

        tracks.forEach((track, idx) => {
            const li = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            button.className = "tianyi-list-item";
            button.dataset.index = String(idx);
            button.setAttribute("aria-label", `播放 ${track.title}`);

            const thumb = createThumb(track.cover, `${track.title} 封面`);
            thumb.className = "tianyi-thumb";

            const info = document.createElement("span");
            info.className = "tianyi-info";

            const title = document.createElement("span");
            title.className = "tianyi-song";
            title.textContent = track.title;

            const artist = document.createElement("span");
            artist.className = "tianyi-artist";
            artist.textContent = track.artist;

            const wave = document.createElement("span");
            wave.className = "tianyi-wave";
            wave.innerHTML = "<i class=\"fas fa-wave-square\" aria-hidden=\"true\"></i>";

            info.append(title, artist);
            button.append(thumb, info, wave);
            li.appendChild(button);
            playlistContainer.appendChild(li);

            button.addEventListener("click", function() {
                const nextIndex = Number(this.dataset.index);
                if (nextIndex === currentTrackIndex) {
                    togglePlayPause();
                    return;
                }
                currentTrackIndex = nextIndex;
                loadTrack(currentTrackIndex);
                playCurrent();
            });
        });
    }

    function renderMarquee() {
        const names = tracks.length ? tracks.map(track => track.title) : ["洛天依", "博客音乐", "本地歌单", "虚拟歌姬"];
        marqueeTrack.innerHTML = "";
        names.concat(names).forEach(name => {
            const span = document.createElement("span");
            span.textContent = name;
            marqueeTrack.appendChild(span);
        });
    }

    function renderMiniCovers() {
        miniCovers.innerHTML = "";
        tracks.slice(0, 5).forEach(track => {
            const image = createThumb(track.cover, `${track.title} 封面`);
            miniCovers.appendChild(image);
        });
    }

    function getRandomTracks(list, count) {
        const shuffled = [...list];
        for (let i = shuffled.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, count);
    }

    function renderAccordion() {
        accordionStack.innerHTML = "";
        getRandomTracks(tracks, 4).forEach(track => {
            const article = document.createElement("article");
            article.className = "tianyi-accordion-card ty-reveal-card";

            const image = createThumb(track.cover, `${track.title} 封面`);
            const content = document.createElement("div");
            const title = document.createElement("h3");
            const copy = document.createElement("p");

            title.textContent = track.title;
            copy.textContent = `${track.artist || "未知艺术家"} 的曲目正在歌单里等待播放。`;
            content.append(title, copy);
            article.append(image, content);
            accordionStack.appendChild(article);
        });
    }

    function setupAudioMotion() {
        if (audioContext && analyser) return Promise.resolve();
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return Promise.resolve();

        try {
            audioContext = new AudioContext();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 128;
            frequencyData = new Uint8Array(analyser.frequencyBinCount);
            mediaSource = audioContext.createMediaElementSource(audio);
            mediaSource.connect(analyser);
            analyser.connect(audioContext.destination);
        } catch (error) {
            analyser = null;
            console.warn("音频动效初始化失败:", error);
        }

        if (audioContext && audioContext.state === "suspended") {
            return audioContext.resume().catch(() => {});
        }
        return Promise.resolve();
    }

    function renderAudioMotion() {
        if (!analyser || !frequencyData) return;
        analyser.getByteFrequencyData(frequencyData);
        const bars = visualizer.querySelectorAll("span");
        let total = 0;

        bars.forEach((bar, index) => {
            const position = Math.floor((index / bars.length) * frequencyData.length);
            const value = frequencyData[position] / 255;
            total += value;
            bar.style.setProperty("--level", Math.max(0.14, value).toFixed(3));
        });

        const energy = total / Math.max(1, bars.length);
        root.style.setProperty("--ty-cover-scale", (1 + energy * 0.03).toFixed(3));
        root.style.setProperty("--ty-glow", (0.18 + energy * 0.5).toFixed(3));
        motionFrame = requestAnimationFrame(renderAudioMotion);
    }

    function startAudioMotion() {
        if (!analyser || motionFrame) return;
        renderAudioMotion();
    }

    function stopAudioMotion() {
        if (motionFrame) {
            cancelAnimationFrame(motionFrame);
            motionFrame = null;
        }
        root.style.setProperty("--ty-cover-scale", "1");
        root.style.setProperty("--ty-glow", "0.24");
    }

    async function playCurrent() {
        if (!tracks.length) return;
        try {
            await setupAudioMotion();
            await audio.play();
            updatePlayPauseIcon(true);
            startAudioMotion();
        } catch (error) {
            console.warn("播放失败:", error);
            updatePlayPauseIcon(false);
        }
    }

    function pauseCurrent() {
        audio.pause();
        updatePlayPauseIcon(false);
        stopAudioMotion();
    }

    function togglePlayPause() {
        if (audio.paused) {
            playCurrent();
        } else {
            pauseCurrent();
        }
    }

    function prevTrack() {
        if (!tracks.length) return;
        const shouldPlay = !audio.paused;
        currentTrackIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
        loadTrack(currentTrackIndex);
        if (shouldPlay) playCurrent();
    }

    function nextTrack() {
        if (!tracks.length) return;
        const shouldPlay = !audio.paused;
        currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
        loadTrack(currentTrackIndex);
        if (shouldPlay) playCurrent();
    }

    async function loadPlaylistFromJSON() {
        try {
            const response = await fetch("list.json");
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const rawData = await response.json();
            tracks = rawData
                .filter(item => item && item.url)
                .map(item => ({
                    title: item.name || "未知名称",
                    artist: item.artist || "未知艺术家",
                    cover: item.cover || "",
                    src: item.url || ""
                }));

            renderPlaylist();
            renderMarquee();
            renderMiniCovers();
            renderAccordion();

            if (!tracks.length) throw new Error("列表为空");
            loadTrack(0);
            initScrollMotion();
        } catch (error) {
            console.error("加载音乐列表失败:", error);
            playlistContainer.innerHTML = "";
            const empty = document.createElement("li");
            empty.className = "tianyi-empty";
            empty.textContent = `加载 list.json 失败，请检查文件是否存在且格式正确。${error.message}`;
            playlistContainer.appendChild(empty);
            trackTitle.textContent = "列表读取失败";
            trackArtist.textContent = error.message;
        }
    }

    function bindEvents() {
        playPauseBtn.addEventListener("click", togglePlayPause);
        heroPlayBtn.addEventListener("click", togglePlayPause);
        footerPlayBtn.addEventListener("click", togglePlayPause);
        prevBtn.addEventListener("click", prevTrack);
        nextBtn.addEventListener("click", nextTrack);

        seekSlider.addEventListener("input", function() {
            isSeeking = true;
            setRangeFill(seekSlider, Number(this.value));
            if (audio.duration) {
                const previewTime = (Number(this.value) / 100) * audio.duration;
                currentTimeSpan.textContent = formatTime(previewTime);
            }
        });

        seekSlider.addEventListener("change", function() {
            if (audio.duration) {
                audio.currentTime = (Number(this.value) / 100) * audio.duration;
            }
            isSeeking = false;
        });

        volumeSlider.addEventListener("input", function() {
            audio.volume = Number(this.value);
            setRangeFill(volumeSlider, Number(this.value) * 100);
        });

        audio.addEventListener("timeupdate", function() {
            if (!isSeeking && audio.duration) {
                const percent = (audio.currentTime / audio.duration) * 100;
                seekSlider.value = percent;
                setRangeFill(seekSlider, percent);
                currentTimeSpan.textContent = formatTime(audio.currentTime);
            }
        });

        audio.addEventListener("loadedmetadata", function() {
            durationSpan.textContent = formatTime(audio.duration);
        });

        audio.addEventListener("ended", function() {
            if (!tracks.length) return;
            currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
            loadTrack(currentTrackIndex);
            playCurrent();
        });

        audio.addEventListener("play", function() {
            updatePlayPauseIcon(true);
            startAudioMotion();
        });

        audio.addEventListener("pause", function() {
            updatePlayPauseIcon(false);
            stopAudioMotion();
        });

        audio.volume = Number(volumeSlider.value);
        setRangeFill(volumeSlider, Number(volumeSlider.value) * 100);
    }

    function initScrollMotion() {
        if (!window.gsap || !window.ScrollTrigger) return;
        window.gsap.registerPlugin(window.ScrollTrigger);

        window.gsap.from(".ty-reveal-copy", {
            y: 34,
            opacity: 0,
            duration: 0.9,
            stagger: 0.12,
            ease: "power3.out"
        });

        window.gsap.utils.toArray(".ty-reveal-card").forEach(card => {
            window.gsap.fromTo(card,
                { scale: 0.94, opacity: 0.38 },
                {
                    scale: 1,
                    opacity: 1,
                    ease: "none",
                    scrollTrigger: {
                        trigger: card,
                        start: "top 88%",
                        end: "bottom 18%",
                        scrub: true
                    }
                }
            );
        });

        if (window.matchMedia("(min-width: 781px)").matches) {
            window.ScrollTrigger.create({
                trigger: ".tianyi-motion-grid",
                start: "top 18%",
                end: "bottom 76%",
                pin: ".ty-pin-copy",
                pinSpacing: false
            });
        }
    }

    buildVisualizer();
    bindEvents();
    loadPlaylistFromJSON();
})();
