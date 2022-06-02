<script type="ts">
  import { link } from "svelte-spa-router";
  import { slug } from "../ts/simpleSlug";
  import { onMount } from "svelte";

  // Mesh Imports:
  import raceCarBodySTL from "../../assets/racecar_body.stl.json";
  import raceCarBackWheelsSTL from "../../assets/racecar_back_wheels.stl.json";
  import raceCarFrontWheelSTL from "../../assets/racecar_front_wheel.stl.json";

  // export let params: { seed: string } | undefined;

  // Canvas:
  let canvas: HTMLCanvasElement;

  // On Mount:
  onMount(() => {

    // Create Scene:
    const scene = new Scene();
    scene.add(new AmbientLight());
    scene.add(new DirectionalLight({
        color: new Color("white"),
        direction: new Vector(1,1,-5),
        brightness: 1
    }));

    // Create Camera:
    const camera = new Camera({
        position: new Vector(-20, 0, 0),
        fov: 90
    });

    // Create Car Body:
    const carBody = new MeshUrbject({
      position: new Vector(0, 0, 0),
      mesh: Mesh.generateFromArrayData(raceCarBodySTL),
      material: new Material({
        fill: new Color("red"),
        // wire: new Color("black")
      })
    });
    scene.add(carBody);

    // Create wheel material:
    const wheelMat = new Material({ fill: new Color(30) });

    // Create Car Back Wheels:
    const carBackWheels = new MeshUrbject({
      position: new Vector(0, 0, 0),
      mesh: Mesh.generateFromArrayData(raceCarBackWheelsSTL),
      material: wheelMat
    });
    scene.add(carBackWheels);

    // Create Car Front Wheels:
    const carFrontLeftWheelMesh = new Mesh.generateFromArrayData(raceCarFrontWheelSTL);
    const carFrontLeftWheel = new MeshUrbject({
      position: new Vector(0, 0, 0),
      mesh: carFrontLeftWheelMesh,
      material: wheelMat
    });
    scene.add(carFrontLeftWheel);
    const carFrontRightWheelMesh = Mesh.scale(carFrontLeftWheelMesh, new Vector(-1,1,1)).inverseNormals();
    const carFrontRightWheel = new MeshUrbject({
      position: new Vector(0, 0, 0),
      mesh: carFrontRightWheelMesh,
      material: wheelMat
    });
    scene.add(carFrontRightWheel);

    // Add test controller:
    const controller = new FocalPointController({
        focalPoint: new Vector(0, 0, 0),
        minDist: 5,
        maxDist: 30,
        zoomMultiplier: 1,
        controlFace: canvas || window
    });
    var timer = new Stats({show: true});
    var draw = function () {
        var t = timer.readTimer() / 1000.0;
        controller.move(camera);
        timer.startTimer();
    };
    var renderer = new PerformanceRenderer({
        canvas,
        frameCallback: draw,
        backgroundColor: new Color("white")
    });
    canvas.addEventListener("mouseover", function () { timer.startTimer(); renderer.start(scene, camera); });
    canvas.addEventListener("mouseleave", function () { renderer.stop(); });
    renderer.render(scene, camera);

  });

</script>

<canvas bind:this={canvas} width="900" height="640"></canvas>

<style>
  canvas {
    margin: 1rem;
  }
</style>