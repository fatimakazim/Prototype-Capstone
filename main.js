document.addEventListener('DOMContentLoaded', () => {

    // --- 1. ELEMENT REFERENCES ---
    const scene        = document.querySelector('a-scene');
    const mapWorld     = document.querySelector('#map-world');
    const villageWorld = document.querySelector('#village-world');
    const cameraRig    = document.querySelector('#camera-rig');
    const fadePlane    = document.querySelector('#fade-plane');
    const dustBurst    = document.querySelector('#dust-burst');
    const mapHotspots  = document.querySelectorAll('.map-hotspot');

    // --- 2. FOG CONFIGURATIONS ---
    // Subtle, dark fog for the cinematic map room
    const fogMap     = 'type: exponential; color: #0a0a14; density: 0.1';
    // Expansive, brighter fog for the open village
    const fogVillage = 'type: exponential; color: #c8d8b8; density: 0.002';

    // Set initial fog to map-room style
    scene.setAttribute('fog', fogMap);

    // --- 3. HOTSPOT CLICK LOGIC ---
    mapHotspots.forEach(hotspot => {
        hotspot.addEventListener('click', function () {
            const targetPos = this.getAttribute('data-target-position');
            const targetRot = this.getAttribute('data-target-rotation');
            triggerTeleportSequence(targetPos, targetRot);
        });
    });

    // --- 4. TELEPORT & TRANSITION SEQUENCE ---
    // This function is intentionally left 100% unchanged from the original.
    // The thumbstick-locomotion component is registered separately in index.html
    // and only modifies position.x / position.z during its tick(), so it will
    // never conflict with the position + rotation values set here.
    function triggerTeleportSequence(targetPos, targetRot) {

        // Step 1: Fade to black
        fadePlane.setAttribute('animation__fadein',
            'property: material.opacity; from: 0; to: 1; dur: 800; easing: linear');

        // Wait for the fade-out to complete before making hard changes
        setTimeout(() => {

            // Step 2: Hide Map World
            mapWorld.setAttribute('visible', 'false');

            // Step 3: Show Village World + update fog
            villageWorld.setAttribute('visible', 'true');
            scene.setAttribute('fog', fogVillage);

            // Step 4 & 5: Move and rotate camera rig to target
            cameraRig.setAttribute('position', targetPos);
            cameraRig.setAttribute('rotation', targetRot);

            // Step 6: Trigger sand/dust burst effect at landing position
            dustBurst.setAttribute('position', targetPos);
            dustBurst.setAttribute('visible', 'true');

            const dustSpheres = dustBurst.querySelectorAll('a-sphere');
            dustSpheres.forEach(sphere => sphere.emit('burst'));

            // Step 7: Fade back in
            fadePlane.removeAttribute('animation__fadein');
            fadePlane.setAttribute('animation__fadeout',
                'property: material.opacity; from: 1; to: 0; dur: 800; easing: linear');

            // Cleanup: hide dust burst once its animation finishes
            setTimeout(() => {
                dustBurst.setAttribute('visible', 'false');
            }, 1600); // slightly longer than the 1500ms burst animation

        }, 850); // 50ms buffer after the 800ms fade-to-black
    }

    // --- 5. GLB MODEL DEBUG HELPERS ---
    const villageModel = document.querySelector('#village-glb');

    villageModel.addEventListener('model-loaded', (e) => {
        console.log('✅ GLB model loaded successfully.');
        const obj    = e.detail.model;
        const box    = new THREE.Box3().setFromObject(obj);
        const size   = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        console.log(`📐 Model size: X=${size.x.toFixed(2)} Y=${size.y.toFixed(2)} Z=${size.z.toFixed(2)}`);
        console.log(`📍 Model center: X=${center.x.toFixed(2)} Y=${center.y.toFixed(2)} Z=${center.z.toFixed(2)}`);
        console.log('💡 Tip: If the model looks too big/small, adjust scale on #village-glb.');

        const currentY = -1.7;
        console.log(`📏 Model floor (min Y) in world space: ${(box.min.y + currentY).toFixed(2)} — should be ≤ 0`);
    });

    villageModel.addEventListener('model-error', (e) => {
        console.error('❌ GLB model failed to load:', e.detail);
    });

    // --- 6. LOADING SCREEN LOGIC ---
    scene.addEventListener('loaded', () => {
        setTimeout(() => {
            document.querySelector('#loading-screen').classList.add('hidden');
        }, 1500);
    });

});