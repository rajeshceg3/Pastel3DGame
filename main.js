import * as THREE from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/build/three.module.js';

function main() {
    const canvas = document.querySelector('#gameCanvas');
    const renderer = new THREE.WebGLRenderer({canvas});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; // Enable shadows in the renderer
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xabcdef); // Light pastel blue

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Softer ambient light
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    // Configure shadow properties
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    scene.add(directionalLight);


    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Initial camera position is now set relative to the player in the render loop.

    // Ground Plane
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x88cc88 }); // Green
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    ground.position.y = 0; // Player's base is at y=0
    ground.receiveShadow = true;
    scene.add(ground);

    // Player character
    const playerCapsuleHeight = 1;
    const playerCapsuleRadius = 0.5;
    const playerGeometry = new THREE.CapsuleGeometry(playerCapsuleRadius, playerCapsuleHeight, 4, 8);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc99 }); // Pastel orange
    const player = new THREE.Mesh(playerGeometry, playerMaterial);
    // Set player position so the bottom of the capsule is at y=0
    // The origin of CapsuleGeometry is its center. Total height = playerCapsuleHeight + 2 * playerCapsuleRadius.
    // So, center y should be (playerCapsuleHeight / 2) + playerCapsuleRadius for bottom to be at 0.
    player.position.set(0, (playerCapsuleHeight / 2) + playerCapsuleRadius, 0);
    player.castShadow = true;
    scene.add(player);
    const playerHalfHeight = (playerCapsuleHeight / 2) + playerCapsuleRadius; // Distance from center to bottom/top edge

    // Obstacles
    const obstacles = [];
    const obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 }); // Grey
    const obstacleData = [
        { geometry: new THREE.BoxGeometry(2, 2, 2), position: new THREE.Vector3(5, 1, 0) },
        { geometry: new THREE.BoxGeometry(1, 3, 1), position: new THREE.Vector3(-3, 1.5, 2) },
        { geometry: new THREE.BoxGeometry(4, 1, 2), position: new THREE.Vector3(0, 0.5, -4) },
    ];

    for (const data of obstacleData) {
        const obstacle = new THREE.Mesh(data.geometry, obstacleMaterial);
        obstacle.position.copy(data.position);
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;
        scene.add(obstacle);
        const obsBB = new THREE.Box3().setFromObject(obstacle);
        obstacles.push({ mesh: obstacle, boundingBox: obsBB });
    }

    // Movement variables
    const baseMoveSpeed = 5.0; // Units per second
    const baseJumpImpulse = 8.0; // Units per second (initial vertical velocity)
    const gravityForce = 25.0; // Units per second squared
    let playerVelocity = new THREE.Vector3();
    let onGround = true;

    const keys = {
        w: false, a: false, s: false, d: false, space: false
    };

    document.addEventListener('keydown', (event) => {
        switch(event.code) {
            case 'KeyW': keys.w = true; break;
            case 'KeyA': keys.a = true; break;
            case 'KeyS': keys.s = true; break;
            case 'KeyD': keys.d = true; break;
            case 'Space': keys.space = true; break;
        }
    });

    document.addEventListener('keyup', (event) => {
        switch(event.code) {
            case 'KeyW': keys.w = false; break;
            case 'KeyA': keys.a = false; break;
            case 'KeyS': keys.s = false; break;
            case 'KeyD': keys.d = false; break;
            case 'Space': keys.space = false; break;
        }
    });


    // Camera control variables
    const cameraOffset = new THREE.Vector3(0, 2.0, 4.0); // Fine-tuned offset
    let cameraPitch = 0; // Initial pitch
    const lookSensitivity = 0.002; // Standard, responsive mouse sensitivity
    const minPitch = -Math.PI / 3;
    const maxPitch = Math.PI / 2.5;

    document.addEventListener('mousemove', (event) => {
        if (document.pointerLockElement === canvas) {
            player.rotation.y -= event.movementX * lookSensitivity;
            cameraPitch -= event.movementY * lookSensitivity;
            cameraPitch = Math.max(minPitch, Math.min(maxPitch, cameraPitch));
        }
    });

    // Pointer lock for better mouse control
    canvas.addEventListener('click', () => {
        if (!document.pointerLockElement) { // Only request if not already locked
            canvas.requestPointerLock();
        }
    });

    const clock = new THREE.Clock(); // For delta time

    function render() {
        const delta = clock.getDelta(); // Get time since last frame (useful for physics)

        // Player movement
        const moveDirection = new THREE.Vector3();
        const rightDirection = new THREE.Vector3();

        // Get player's forward and right vectors (movement is on XZ plane)
        player.getWorldDirection(moveDirection);
        moveDirection.y = 0;
        moveDirection.normalize().multiplyScalar(-1); // Forward
        rightDirection.copy(moveDirection).cross(player.up).normalize(); // Right

        const currentMoveSpeed = baseMoveSpeed * delta;
        const intendedDisplacement = new THREE.Vector3();
        if (keys.w) {
            intendedDisplacement.addScaledVector(moveDirection, currentMoveSpeed);
        }
        if (keys.s) {
            intendedDisplacement.addScaledVector(moveDirection, -currentMoveSpeed);
        }
        if (keys.a) {
            intendedDisplacement.addScaledVector(rightDirection, -currentMoveSpeed);
        }
        if (keys.d) {
            intendedDisplacement.addScaledVector(rightDirection, currentMoveSpeed);
        }

        // Create a bounding box for the player, centered at the player's feet for XZ collision
        // This BB is relative to player's origin, which is its center.
        // Min: (-radius, -halfHeight, -radius)
        // Max: ( radius,  halfHeight,  radius)
        const playerBB = new THREE.Box3(
            new THREE.Vector3(-playerCapsuleRadius, -playerHalfHeight, -playerCapsuleRadius),
            new THREE.Vector3(playerCapsuleRadius,  playerHalfHeight,  playerCapsuleRadius)
        );
        // Translate this BB to where the player wants to go
        playerBB.translate(player.position.clone().add(intendedDisplacement));


        let canMove = true;
        for (const obstacle of obstacles) {
            if (playerBB.intersectsBox(obstacle.boundingBox)) {
                canMove = false;
                break;
            }
        }

        if (canMove) {
            player.position.add(intendedDisplacement);
        }

        // Jumping and Gravity
        const currentBottomY = player.position.y - playerHalfHeight;

        if (keys.space && onGround) {
            playerVelocity.y = baseJumpImpulse; // This is an impulse, so not scaled by delta here
            onGround = false;
        }

        if (!onGround || playerVelocity.y > 0) {
            playerVelocity.y -= gravityForce * delta; // gravityForce is an acceleration
        } else if (onGround && playerVelocity.y < 0) {
            playerVelocity.y = 0; // Prevent residual downward velocity when on ground
        }

        player.position.y += playerVelocity.y * delta; // Velocity applied over time (delta)

        const newBottomY = player.position.y - playerHalfHeight;

        if (newBottomY <= 0) { // Ground is at y=0
            player.position.y = playerHalfHeight; // Place bottom of player capsule exactly on the ground
            playerVelocity.y = 0;
            onGround = true;
        } else {
            onGround = false; // Player is in the air
        }


        // Calculate desired camera position
        const desiredCameraPosition = new THREE.Vector3();
        desiredCameraPosition.copy(cameraOffset); // Start with the base offset
        desiredCameraPosition.applyQuaternion(player.quaternion); // Rotate offset by player's rotation
        desiredCameraPosition.add(player.position); // Add player's position

        // Apply pitch to the camera
        const cameraLookAt = new THREE.Vector3(0,0,-1); // Camera looks along its local -Z
        cameraLookAt.applyQuaternion(player.quaternion); // Rotate by player's Y rotation
        cameraLookAt.applyAxisAngle(new THREE.Vector3(1,0,0).applyQuaternion(player.quaternion), cameraPitch); // Apply pitch relative to player's orientation

        camera.position.copy(desiredCameraPosition);
        camera.lookAt(player.position.clone().add(cameraLookAt)); // Look at a point in the direction of pitch relative to player

        renderer.render(scene, camera);
        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

main();
