
// Web Worker Script (Johnson's Algorithm)
self.onmessage = function(event) {
  const graph = event.data.graph;
  const numVertices = Object.keys(graph).length;
  let iteration = 0;

  // Initialize graph distances for Dijkstra's and Bellman-Ford
  const initializeDistances = (graph, source) => {
    const dist = {};
    for (const v in graph) {
      dist[v] = Infinity;
    }
    dist[source] = 0;
    return dist;
  };

  // Bellman-Ford algorithm to reweight the graph (no negative-weight cycle check needed)
  const bellmanFord = (graph, source) => {
    const dist = initializeDistances(graph, source);
    for (let i = 0; i < numVertices - 1; i++) {
      for (const u in graph) {
        for (const v of graph[u]) {
          if (dist[u] !== Infinity && dist[u] + 1 < dist[v]) {
            dist[v] = dist[u] + 1;
          }
        }
      }
    }
    return dist;
  };

  // Dijkstra's algorithm
  const dijkstra = (graph, source) => {
    const dist = initializeDistances(graph, source);
    const visited = new Set();
    const pq = new MinPriorityQueue({ priority: x => dist[x] });

    pq.enqueue(source);

    while (!pq.isEmpty()) {
      const u = pq.dequeue().element;
      visited.add(u);

      for (const v of graph[u]) {
        if (!visited.has(v)) {
          const alt = dist[u] + 1;
          if (alt < dist[v]) {
            dist[v] = alt;
            pq.enqueue(v);
          }
        }
      }
    }
    return dist;
  };

  // Johnson's algorithm
  const johnsonsAlgorithm = (graph) => {
    const newVertex = Symbol("newVertex");
    graph[newVertex] = [];

    // Add edges from the new vertex to all other vertices
    for (const v in graph) {
      if (v !== newVertex) {
        graph[newVertex].push(v);
      }
    }

    // Step 1: Use Bellman-Ford to reweight the graph
    const h = bellmanFord(graph, newVertex);

    // Step 2: Remove the new vertex and run Dijkstra's from each vertex
    delete graph[newVertex];
    const allPairsDist = {};
    let totalIterations = numVertices ** 2;
    for (const u in graph) {
      allPairsDist[u] = dijkstra(graph, u);

      // Update progress after every Dijkstra run
      iteration++;
      const progress = (iteration / totalIterations) * 100;
      self.postMessage({ progress: progress });
    }

    self.postMessage({ result: allPairsDist });
  };

  // MinPriorityQueue implementation for Dijkstra's algorithm
  class MinPriorityQueue {
    constructor(options) {
      this.queue = [];
      this.priority = options.priority;
    }

    enqueue(element) {
      this.queue.push(element);
      this.queue.sort((a, b) => this.priority(a) - this.priority(b));
    }

    dequeue() {
      return this.queue.shift();
    }

    isEmpty() {
      return this.queue.length === 0;
    }
  }

  // Run Johnson's algorithm on the graph
  johnsonsAlgorithm(graph);
};

