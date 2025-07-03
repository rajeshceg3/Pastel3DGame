import * as THREE from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/build/three.module.js';

// Define Resource Types
const resourceTypes = [
    {
        id: "pastelFlower",
        name: "Pastel Flower",
        modelGeometry: new THREE.SphereGeometry(0.3, 16, 16),
        modelMaterial: new THREE.MeshStandardMaterial({ color: 0xffb6c1 }),
        modelHeight: 0.6 // Diameter of the sphere
    },
    {
        id: "glimmeringCrystal",
        name: "Glimmering Crystal",
        modelGeometry: new THREE.BoxGeometry(0.25, 0.4, 0.25),
        modelMaterial: new THREE.MeshStandardMaterial({ color: 0xa0e6ff }),
        modelHeight: 0.4 // Height of the box
    },
    {
        id: "softWood",
        name: "Soft Wood",
        modelGeometry: new THREE.CylinderGeometry(0.2, 0.2, 0.5, 8),
        modelMaterial: new THREE.MeshStandardMaterial({ color: 0xdeb887 }),
        modelHeight: 0.5 // Height of the cylinder
    }
];

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

    const collectibleResources = []; // Initialize collectibleResources array
    const playerInventory = {}; // Initialize playerInventory object

    let islandMesh; // Will be assigned after island creation.

    // Grid parameters
    const islandSize = 100; // Assuming island is roughly 100x100
    const cellSize = 10;
    const gridWidth = Math.ceil(islandSize / cellSize);
    const gridHeight = Math.ceil(islandSize / cellSize);
    const gridOrigin = new THREE.Vector2(-islandSize / 2, -islandSize / 2); // Assuming island center is at (0,0)
    const spatialGrid = new Map();

    // Player geometry constants - if not defined elsewhere
    const playerCapsuleRadius = 0.5; // Example value
    const playerCapsuleHeight = 1.0; // Example value


    // Helper function to get height of the island at a given point
    // Make sure islandMesh is accessible in the scope where this function is used or passed as a parameter.
    // For now, assume islandMesh will be a global or accessible variable in main() scope.
    function getHeightAtPoint(x, z, mesh) {
        if (!mesh) return 0; // Return 0 if mesh is not yet defined

        const raycaster = new THREE.Raycaster();
        const rayOrigin = new THREE.Vector3(x, 200, z); // Start ray from high above
        const rayDirection = new THREE.Vector3(0, -1, 0); // Ray points downwards
        raycaster.set(rayOrigin, rayDirection);

        const intersects = raycaster.intersectObject(mesh);

        if (intersects.length > 0) {
            return intersects[0].point.y; // Return the y-coordinate of the intersection point
        }
        return 0; // Default height if no intersection (e.g., outside island bounds)
    }

    // Spatial Grid Functions
    function getGridCellKey(position) {
        const gridX = Math.floor((position.x - gridOrigin.x) / cellSize);
        const gridZ = Math.floor((position.z - gridOrigin.y) / cellSize);
        return `${gridX}_${gridZ}`;
    }

    function addToGrid(resource) {
        const cellKey = getGridCellKey(resource.mesh.position);
        if (!spatialGrid.has(cellKey)) {
            spatialGrid.set(cellKey, []);
        }
        spatialGrid.get(cellKey).push(resource);
    }

    function removeFromGrid(resource) {
        const cellKey = getGridCellKey(resource.mesh.position);
        if (spatialGrid.has(cellKey)) {
            const cellResources = spatialGrid.get(cellKey);
            const index = cellResources.indexOf(resource);
            if (index > -1) {
                cellResources.splice(index, 1);
            }
            if (cellResources.length === 0) {
                spatialGrid.delete(cellKey);
            }
        }
    }

// Add this function somewhere before it's called (e.g., after camera setup or before player setup)
function createIslandMesh(width = 100, height = 100, segments = 50, noiseScale = 20, elevationScale = 5) {
    const geometry = new THREE.PlaneGeometry(width, height, segments, segments);
    const positionAttribute = geometry.attributes.position;

    // Add random offsets for uniqueness
    const randomOffsetX = Math.random() * 1000;
    const randomOffsetY = Math.random() * 1000;

    for (let i = 0; i < positionAttribute.count; i++) {
        const x = positionAttribute.getX(i);
        const y = positionAttribute.getY(i); // This is the original y of the plane vertex

        // Simple noise: Math.random() creates a somewhat chaotic terrain.
        // A proper noise function (Simplex/Perlin) would be smoother.
        // The z-coordinate of the vertex is modified to create height.
        // After rotation, this z becomes the new y (height).

        // A slightly more structured noise using x and y, with random offsets
        const zOffset = Math.sin((x + randomOffsetX) / noiseScale) * Math.cos((y + randomOffsetY) / noiseScale) * elevationScale;

        positionAttribute.setZ(i, zOffset);
    }

    geometry.computeVertexNormals(); // Important for lighting

    // Placeholder material - will be updated in the next step
    const material = new THREE.MeshStandardMaterial({ color: 0x90EE90, flatShading: false }); // Pastel light green
    const islandMesh = new THREE.Mesh(geometry, material);

    // Rotate the plane to be horizontal (like the original ground)
    islandMesh.rotation.x = -Math.PI / 2;
    islandMesh.receiveShadow = true;

    return islandMesh;
}

// Function to spawn resources
function spawnResources(islandMesh, scene, resourceTypes, collectibleResources, numInstancesPerType = 15) {
    resourceTypes.forEach(type => {
        for (let i = 0; i < numInstancesPerType; i++) {
            // Generate random x and z coordinates within island boundaries (-48 to 48)
            const x = Math.random() * 96 - 48;
            const z = Math.random() * 96 - 48;

            const yTerrain = getHeightAtPoint(x, z, islandMesh);

            // Create the mesh
            const resourceMesh = new THREE.Mesh(type.modelGeometry, type.modelMaterial);

            // Set position
            resourceMesh.position.set(x, yTerrain + type.modelHeight / 2, z);

            // Enable shadows
            resourceMesh.castShadow = true;
            resourceMesh.receiveShadow = true;

            // Add to scene
            scene.add(resourceMesh);

            const newlyCreatedResource = { mesh: resourceMesh, id: type.id, name: type.name };
            // Add to collectible array
            collectibleResources.push(newlyCreatedResource);
            // Add to spatial grid
            addToGrid(newlyCreatedResource);
        }
    });
}

// Updated collectResource function
function collectResource(resourceToCollect, index, collectiblesArray, scene, playerInventory) {
    // Remove from spatial grid before removing from scene or array
    removeFromGrid(resourceToCollect);

    // Remove mesh from scene and dispose of its resources
    if (resourceToCollect.mesh) {
        scene.remove(resourceToCollect.mesh);
        resourceToCollect.mesh.geometry.dispose(); // Clean up geometry
        resourceToCollect.mesh.material.dispose(); // Clean up material
    }
    // Remove from collectibleResources array
    collectiblesArray.splice(index, 1);

    // Update player inventory
    if (playerInventory[resourceToCollect.id]) {
        playerInventory[resourceToCollect.id]++;
    } else {
        playerInventory[resourceToCollect.id] = 1;
    }

    // Log collection to console
    console.log(`Collected: ${resourceToCollect.name}! You now have ${playerInventory[resourceToCollect.id]} of ${resourceToCollect.name}(s).`);
    displayInventory(); // Display the formatted inventory
}

function displayInventory() {
    console.log("Player Inventory:");

    const inventoryItems = Object.keys(playerInventory);

    if (inventoryItems.length === 0) {
        console.log("  Empty");
        return;
    }

    const itemStrings = [];
    for (const resourceId of inventoryItems) {
        const resource = resourceTypes.find(rt => rt.id === resourceId);
        if (resource) {
            itemStrings.push(`  ${resource.name}: ${playerInventory[resourceId]}`);
        } else {
            // This case should ideally not happen if inventory is managed correctly
            itemStrings.push(`  Unknown Resource (${resourceId}): ${playerInventory[resourceId]}`);
        }
    }
    itemStrings.forEach(itemString => console.log(itemString));
}

    // Create and add the island
    // islandMesh was declared globally or in a wider scope to be accessible by getHeightAtPoint and render loop
    islandMesh = createIslandMesh(); // Using default parameters for now
    scene.add(islandMesh);

    // Player character
    const playerHalfHeight = (playerCapsuleHeight / 2) + playerCapsuleRadius;

    // Player object creation (assuming it happens here or earlier)
    const playerGeometry = new THREE.CapsuleGeometry(playerCapsuleRadius, playerCapsuleHeight, 4, 8);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc99 }); // Pastel orange
    const player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.castShadow = true;

    // Set player's initial position on the island
    const initialPlayerX = 0;
    const initialPlayerZ = 0;
    const islandSurfaceY = getHeightAtPoint(initialPlayerX, initialPlayerZ, islandMesh);
    player.position.set(initialPlayerX, islandSurfaceY + playerHalfHeight, initialPlayerZ);
    scene.add(player); // Player added to scene AFTER position is set.
    // Ensure player is added to the scene *after* its position is set, if it wasn't added before.
    // If player is already added, this position update is fine.

    // Spawn resources on the island
    spawnResources(islandMesh, scene, resourceTypes, collectibleResources);

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
        w: false, a: false, s: false, d: false, space: false, e: false
    };

    document.addEventListener('keydown', (event) => {
        switch(event.code) {
            case 'KeyW': keys.w = true; break;
            case 'KeyA': keys.a = true; break;
            case 'KeyS': keys.s = true; break;
            case 'KeyD': keys.d = true; break;
            case 'Space': keys.space = true; break;
            case 'KeyE': keys.e = true; break; // Add this line
        }
    });

    document.addEventListener('keyup', (event) => {
        switch(event.code) {
            case 'KeyW': keys.w = false; break;
            case 'KeyA': keys.a = false; break;
            case 'KeyS': keys.s = false; break;
            case 'KeyD': keys.d = false; break;
            case 'Space': keys.space = false; break;
            case 'KeyE': keys.e = false; break; // Add this line
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

        // Ground collision and response
        const playerFeetX = player.position.x;
        const playerFeetZ = player.position.z;
        const islandSurfaceY = getHeightAtPoint(playerFeetX, playerFeetZ, islandMesh);

        const newBottomY = player.position.y - playerHalfHeight;

        if (newBottomY <= islandSurfaceY) {
            player.position.y = islandSurfaceY + playerHalfHeight;
            playerVelocity.y = 0;
            onGround = true;
        } else {
            onGround = false;
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

        // Resource Collection Logic
        if (keys.e) { // Check if 'E' is pressed
            const collectionDistance = 2.5; // Make sure this is defined
            const playerCellKey = getGridCellKey(player.position);
            const cellsToSearch = [playerCellKey];

            const playerGridX = Math.floor((player.position.x - gridOrigin.x) / cellSize);
            const playerGridZ = Math.floor((player.position.z - gridOrigin.y) / cellSize);

            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    if (dx === 0 && dz === 0) continue;
                    cellsToSearch.push(`${playerGridX + dx}_${playerGridZ + dz}`);
                }
            }

            const processedResources = new Set();
            for (const cellKey of cellsToSearch) {
                if (spatialGrid.has(cellKey)) {
                    const resourcesInCell = spatialGrid.get(cellKey);
                    // Iterate backwards because collectResource can modify this array by calling removeFromGrid
                    for (let i = resourcesInCell.length - 1; i >= 0; i--) {
                        const resource = resourcesInCell[i];
                        if (!resource.mesh || processedResources.has(resource)) continue;

                        const distanceToPlayer = player.position.distanceTo(resource.mesh.position);
                        if (distanceToPlayer < collectionDistance) {
                            // Find the index of this resource in the global collectibleResources array
                            const globalIndex = collectibleResources.findIndex(r => r === resource);
                            if (globalIndex !== -1) {
                                collectResource(resource, globalIndex, collectibleResources, scene, playerInventory);
                                processedResources.add(resource); // Mark as processed
                                // Optional: break or continue for single item collection logic
                            }
                        }
                    }
                }
            }
            keys.e = false; // Consume the key press for this frame
        }

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
