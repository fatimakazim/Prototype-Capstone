/**
 * Saidpur Village VR - Enhanced Interactive Experience
 * Features: Proximity Triggers, Dual-Layered Audio, VR Hand-Tracking Support
 */

// ============================================================================
// PROXIMITY TRIGGER COMPONENT
// ============================================================================
AFRAME.registerComponent('proximity-trigger', {
    schema: {
        distance: { type: 'number', default: 2.0 },
        triggered: { type: 'boolean', default: false }
    },

    init: function () {
        this.camera = null;
        this.hotspotPosition = new THREE.Vector3();
        this.cameraPosition = new THREE.Vector3();
        this.triggered = false;
    },

    tick: function () {
        // Don't check if already triggered or in video mode
        if (this.triggered || window.villageVR?.isInVideoMode) {
            return;
        }

        // Get camera reference (try both desktop and VR cameras)
        if (!this.camera) {
            this.camera = document.querySelector('#desktop-camera') || 
                         document.querySelector('#vr-camera') || 
                         document.querySelector('[camera]');
        }

        if (!this.camera) return;

        // Get positions
        this.el.object3D.getWorldPosition(this.hotspotPosition);
        this.camera.object3D.getWorldPosition(this.cameraPosition);

        // Calculate distance
        const distance = this.hotspotPosition.distanceTo(this.cameraPosition);

        // Trigger if within range
        if (distance <= this.data.distance) {
            console.log(`Proximity triggered! Distance: ${distance.toFixed(2)}m`);
            this.triggered = true;
            
            // Call the universal transition function
            if (window.villageVR && window.villageVR.transitionToVideo) {
                window.villageVR.transitionToVideo('proximity');
            }
        }
    },

    reset: function () {
        this.triggered = false;
    }
});

// ============================================================================
// MAIN VILLAGE VR APPLICATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Core Elements
    const sky = document.querySelector('#main-sky');
    const villageWorld = document.querySelector('#village-world');
    const exitBtn = document.querySelector('#exit-btn');
    const uiOverlay = document.querySelector('#ui-overlay');
    const rig = document.querySelector('#rig');
    const hotspotContainer = document.querySelector('#hotspot-container');
    const desktopCamera = document.querySelector('#desktop-camera');
    const vrCamera = document.querySelector('#vr-camera');
    const leftHand = document.querySelector('#left-hand');
    const rightHand = document.querySelector('#right-hand');

    // Audio Elements
    const villageAudioEntity = document.querySelector('#village-audio-entity');
    const ambientVillageAudio = document.querySelector('#ambient-village');
    const videoAudio = document.querySelector('#video-audio');

    // Video Element
    const video360 = document.querySelector('#vid-360');

    // State Management
    let isInVideoMode = false;
    let isVRMode = false;
    let audioFadeInterval = null;

    // Global namespace for external access
    window.villageVR = {
        isInVideoMode: false,
        transitionToVideo: null,
        exitVideoMode: null
    };

    // ========================================================================
    // VR MODE DETECTION
    // ========================================================================
    const scene = document.querySelector('a-scene');
    
    scene.addEventListener('enter-vr', () => {
        console.log('Entered VR mode');
        isVRMode = true;
        
        // Switch to VR camera and controls
        desktopCamera.setAttribute('camera', 'active', false);
        vrCamera.setAttribute('camera', 'active', true);
        vrCamera.setAttribute('visible', true);
        desktopCamera.setAttribute('visible', false);
        
        // Show VR hands
        leftHand.setAttribute('visible', true);
        rightHand.setAttribute('visible', true);
        
        // Disable desktop controls
        desktopCamera.removeAttribute('wasd-controls');
        desktopCamera.removeAttribute('look-controls');
    });

    scene.addEventListener('exit-vr', () => {
        console.log('Exited VR mode');
        isVRMode = false;
        
        // Switch back to desktop camera
        vrCamera.setAttribute('camera', 'active', false);
        desktopCamera.setAttribute('camera', 'active', true);
        desktopCamera.setAttribute('visible', true);
        vrCamera.setAttribute('visible', false);
        
        // Hide VR hands
        leftHand.setAttribute('visible', false);
        rightHand.setAttribute('visible', false);
        
        // Re-enable desktop controls
        desktopCamera.setAttribute('wasd-controls', 'acceleration', 20);
        desktopCamera.setAttribute('look-controls', '');
    });

    // ========================================================================
    // DUAL-LAYERED AUDIO ENGINE
    // ========================================================================
    const AudioEngine = {
        fadeOut: function(audioElement, duration = 1000) {
            return new Promise((resolve) => {
                if (!audioElement || audioElement.paused) {
                    resolve();
                    return;
                }

                const startVolume = audioElement.volume;
                const fadeStep = startVolume / (duration / 50);
                
                audioFadeInterval = setInterval(() => {
                    if (audioElement.volume > fadeStep) {
                        audioElement.volume -= fadeStep;
                    } else {
                        audioElement.volume = 0;
                        audioElement.pause();
                        clearInterval(audioFadeInterval);
                        resolve();
                    }
                }, 50);
            });
        },

        fadeIn: function(audioElement, targetVolume = 0.6, duration = 1000) {
            return new Promise((resolve) => {
                if (!audioElement) {
                    resolve();
                    return;
                }

                audioElement.volume = 0;
                audioElement.play().catch(err => {
                    console.warn('Audio autoplay prevented:', err);
                });

                const fadeStep = targetVolume / (duration / 50);
                
                audioFadeInterval = setInterval(() => {
                    if (audioElement.volume < targetVolume - fadeStep) {
                        audioElement.volume += fadeStep;
                    } else {
                        audioElement.volume = targetVolume;
                        clearInterval(audioFadeInterval);
                        resolve();
                    }
                }, 50);
            });
        },

        stopVillageAudio: async function() {
            console.log('Stopping village ambient audio...');
            
            // Fade out spatialized audio
            if (villageAudioEntity) {
                const soundComponent = villageAudioEntity.components.sound;
                if (soundComponent) {
                    await this.fadeOut(soundComponent.audio, 800);
                }
            }
            
            // Also fade out the raw audio element as backup
            if (ambientVillageAudio) {
                await this.fadeOut(ambientVillageAudio, 800);
            }
        },

        startVillageAudio: async function() {
            console.log('Starting village ambient audio...');
            
            // Fade in spatialized audio
            if (villageAudioEntity) {
                const soundComponent = villageAudioEntity.components.sound;
                if (soundComponent && soundComponent.audio) {
                    await this.fadeIn(soundComponent.audio, 0.6, 1000);
                }
            }
            
            // Also fade in raw audio as backup
            if (ambientVillageAudio) {
                await this.fadeIn(ambientVillageAudio, 0.6, 1000);
            }
        },

        startVideoAudio: async function() {
            console.log('Starting video audio...');
            
            // First, check if video has audio track
            if (video360 && !video360.muted) {
                // Use video's native audio
                video360.volume = 0;
                await this.fadeIn(video360, 0.8, 1000);
            } else if (videoAudio) {
                // Use separate audio track
                await this.fadeIn(videoAudio, 0.8, 1000);
            }
        },

        stopVideoAudio: async function() {
            console.log('Stopping video audio...');
            
            // Stop video's native audio
            if (video360) {
                await this.fadeOut(video360, 500);
            }
            
            // Stop separate audio track
            if (videoAudio) {
                videoAudio.pause();
                videoAudio.currentTime = 0;
            }
        }
    };

    // ========================================================================
    // UNIVERSAL TRANSITION TO VIDEO FUNCTION
    // ========================================================================
    async function transitionToVideo(triggerType = 'unknown') {
        if (isInVideoMode) {
            console.log('Already in video mode, ignoring trigger');
            return;
        }

        console.log(`🎬 Transitioning to video (triggered by: ${triggerType})`);
        isInVideoMode = true;
        window.villageVR.isInVideoMode = true;

        try {
            // 1. AUDIO TRANSITION: Fade out village audio
            await AudioEngine.stopVillageAudio();

            // 2. VISUAL TRANSITION: Switch sky to video
            sky.setAttribute('src', '#vid-360');
            sky.setAttribute('color', '#ffffff');
            
            // 3. Play the 360° video
            await video360.play();

            // 4. AUDIO TRANSITION: Fade in video audio
            await AudioEngine.startVideoAudio();

            // 5. Hide the 3D village world
            villageWorld.setAttribute('visible', 'false');

            // 6. Disable movement controls
            if (desktopCamera.hasAttribute('wasd-controls')) {
                desktopCamera.setAttribute('wasd-controls', 'enabled', false);
            }

            // 7. Update UI
            exitBtn.style.display = 'block';
            uiOverlay.style.display = 'none';

            // 8. Add video ended listener
            video360.addEventListener('ended', onVideoEnded);

            console.log('✅ Video transition complete');

        } catch (error) {
            console.error('Error during video transition:', error);
            // Rollback on error
            exitVideoMode();
        }
    }

    // ========================================================================
    // EXIT VIDEO MODE FUNCTION
    // ========================================================================
    async function exitVideoMode() {
        if (!isInVideoMode) {
            console.log('Not in video mode, ignoring exit');
            return;
        }

        console.log('🏠 Returning to village...');

        try {
            // 1. AUDIO TRANSITION: Fade out video audio
            await AudioEngine.stopVideoAudio();

            // 2. Stop and reset video
            video360.pause();
            video360.currentTime = 0;
            video360.removeEventListener('ended', onVideoEnded);

            // 3. VISUAL TRANSITION: Restore village sky
            sky.setAttribute('src', '#sky-tex');
            sky.setAttribute('color', '#e8d4b0');

            // 4. Show the 3D village world
            villageWorld.setAttribute('visible', 'true');

            // 5. Re-enable movement controls
            if (desktopCamera && !isVRMode) {
                desktopCamera.setAttribute('wasd-controls', 'acceleration', 20);
            }

            // 6. Update UI
            exitBtn.style.display = 'none';
            uiOverlay.style.display = 'block';

            // 7. Reset proximity trigger
            if (hotspotContainer && hotspotContainer.components['proximity-trigger']) {
                hotspotContainer.components['proximity-trigger'].reset();
            }

            // 8. AUDIO TRANSITION: Fade in village audio
            await AudioEngine.startVillageAudio();

            // 9. Reset state
            isInVideoMode = false;
            window.villageVR.isInVideoMode = false;

            console.log('✅ Returned to village');

        } catch (error) {
            console.error('Error during exit:', error);
        }
    }

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================
    
    // Desktop Click Handler
    if (hotspotContainer) {
        hotspotContainer.addEventListener('click', function() {
            console.log('Hotspot clicked (desktop)');
            transitionToVideo('click');
        });
    }

    // VR Hand Collision Handler (using raycaster intersection)
    if (leftHand && rightHand) {
        [leftHand, rightHand].forEach(hand => {
            hand.addEventListener('triggerdown', () => {
                // Check if hand is near hotspot
                const handPosition = new THREE.Vector3();
                const hotspotPosition = new THREE.Vector3();
                
                hand.object3D.getWorldPosition(handPosition);
                hotspotContainer.object3D.getWorldPosition(hotspotPosition);
                
                const distance = handPosition.distanceTo(hotspotPosition);
                
                if (distance <= 2.0 && !isInVideoMode) {
                    console.log('VR hand trigger near hotspot');
                    transitionToVideo('vr-hand');
                }
            });
        });
    }

    // Exit Button Click Handler
    exitBtn.addEventListener('click', () => {
        console.log('Exit button clicked');
        exitVideoMode();
    });

    // Video Ended Handler
    function onVideoEnded() {
        console.log('Video playback ended');
        setTimeout(() => {
            exitVideoMode();
        }, 1000);
    }

    // ========================================================================
    // KEYBOARD SHORTCUTS
    // ========================================================================
    document.addEventListener('keydown', (event) => {
        // ESC key to exit video mode
        if (event.key === 'Escape' && isInVideoMode) {
            exitVideoMode();
        }
        
        // H key to toggle UI overlay
        if (event.key === 'h' || event.key === 'H') {
            if (!isInVideoMode) {
                uiOverlay.style.display = uiOverlay.style.display === 'none' ? 'block' : 'none';
            }
        }

        // T key for manual testing of audio
        if (event.key === 't' || event.key === 'T') {
            console.log('Testing audio system...');
            console.log('Village audio:', ambientVillageAudio?.paused ? 'paused' : 'playing');
            console.log('Video audio:', videoAudio?.paused ? 'paused' : 'playing');
        }
    });

    // ========================================================================
    // EXPOSE FUNCTIONS GLOBALLY
    // ========================================================================
    window.villageVR.transitionToVideo = transitionToVideo;
    window.villageVR.exitVideoMode = exitVideoMode;

    // ========================================================================
    // SCENE INITIALIZATION
    // ========================================================================
    if (scene.hasLoaded) {
        onSceneLoaded();
    } else {
        scene.addEventListener('loaded', onSceneLoaded);
    }

    function onSceneLoaded() {
        console.log('🏛️ Saidpur Village VR - Scene loaded');
        console.log('📱 Controls:');
        console.log('  Desktop: WASD to move, Mouse to look, Click/Approach golden sphere');
        console.log('  VR: Hand tracking + Blink teleport, Trigger near hotspot');
        console.log('  ESC: Exit video mode | H: Toggle UI');
        
        // Start village ambient audio
        setTimeout(() => {
            AudioEngine.startVillageAudio().catch(err => {
                console.warn('Autoplay blocked. User interaction required:', err);
            });
        }, 500);
    }

    // ========================================================================
    // PERFORMANCE & ERROR HANDLING
    // ========================================================================
    
    // Pause videos when tab is hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && video360) {
            video360.pause();
        }
    });

    // Video error handling
    video360.addEventListener('error', (e) => {
        console.error('Video loading error:', e);
        alert('Unable to load 360° video. Please check your connection and try again.');
    });

    // Audio error handling
    [ambientVillageAudio, videoAudio].forEach(audio => {
        if (audio) {
            audio.addEventListener('error', (e) => {
                console.error('Audio loading error:', e);
            });
        }
    });

    // Mobile device optimization
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        console.log('📱 Mobile device detected - Optimized experience');
    }

    // ========================================================================
    // ACCESSIBILITY
    // ========================================================================
    function announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        document.body.appendChild(announcement);
        setTimeout(() => announcement.remove(), 1000);
    }

    // Initial announcement
    setTimeout(() => {
        announceToScreenReader('Saidpur Village VR experience loaded. Approach the golden sphere or click it to watch 360 video.');
    }, 2000);

    // ========================================================================
    // DEBUG HELPERS (Remove in production)
    // ========================================================================
    window.debugVillageVR = {
        getState: () => ({
            isInVideoMode,
            isVRMode,
            villageAudioPlaying: !ambientVillageAudio?.paused,
            videoAudioPlaying: !videoAudio?.paused,
            video360Playing: !video360?.paused
        }),
        forceTransition: () => transitionToVideo('debug'),
        forceExit: () => exitVideoMode(),
        testAudio: () => {
            console.log('Audio Test:');
            console.log('  Village:', ambientVillageAudio);
            console.log('  Video:', videoAudio);
            console.log('  360 Video:', video360);
        }
    };

    console.log('💡 Debug helpers available: window.debugVillageVR');
    // 1. Gesture Movement Component
AFRAME.registerComponent('hand-gesture-move', {
  schema: {
    rig: { type: 'selector' },
    speed: { type: 'number', default: 0.05 }
  },

  init: function () {
    this.camera = document.querySelector('[camera]');
    this.direction = new THREE.Vector3();
  },

  tick: function () {
    if (!this.el.active || !this.data.rig) return;

    const handPos = this.el.object3D.position;
    const camPos = this.camera.object3D.position;

    // Calculate vertical offset relative to head
    const threshold = 0.2; 
    const diff = handPos.y - camPos.y;

    if (diff > threshold) {
      // Move Forward
      this.move(1);
    } else if (diff < -threshold - 0.1) {
      // Move Backward
      this.move(-1);
    }
  },

  move: function (dirMultiplier) {
    const rig = this.data.rig.object3D;
    // Get the direction the user is looking
    this.camera.object3D.getWorldDirection(this.direction);
    // Project direction onto XZ plane (prevent flying/sinking)
    this.direction.y = 0;
    this.direction.normalize();
    
    rig.position.addScaledVector(this.direction, this.data.speed * dirMultiplier);
  }
});

// 2. Pinch Interaction Component
AFRAME.registerComponent('pinch-to-click', {
  init: function () {
    this.el.addEventListener('pinchstarted', (evt) => {
      // Get the position of the pinch
      const pinchPos = evt.detail.position;
      
      // Find all hotspots
      const hotspots = document.querySelectorAll('.hotspot');
      hotspots.forEach(hs => {
        const hsPos = new THREE.Vector3();
        hs.object3D.getWorldPosition(hsPos);
        
        // Check distance between pinch and hotspot (0.3m threshold)
        if (pinchPos.distanceTo(hsPos) < 0.3) {
          hs.emit('click');
        }
      });
    });
  }
});
});