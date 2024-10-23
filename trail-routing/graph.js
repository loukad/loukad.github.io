// Function to calculate distance between two points
function distanceBetween(pointA, pointB) {
  return turf.distance(turf.point(pointA), turf.point(pointB));
}

// Returns the length of the given track defined in coordinates in units of meters
function trackLength(coordinates) {
  let cumulativeDistance = 0;

  for (let i = 1; i < coordinates.length; i++) {
    cumulativeDistance += distanceBetween(coordinates[i - 1], coordinates[i]);
  }
  return cumulativeDistance * 1000;
}

function connectPoints(graph, dists, firstPoint, lastPoint, distance) {
  const firstPointKey = getPointKey(firstPoint);
  const lastPointKey = getPointKey(lastPoint);

  // Add an edge in the graph between the first point and the last point
  if (!graph[firstPointKey]) {
    graph[firstPointKey] = new Set();
  }
  if (!graph[lastPointKey]) {
    graph[lastPointKey] = new Set();
  }
  graph[firstPointKey].add(lastPointKey);
  graph[lastPointKey].add(firstPointKey);

  // Update the distance map with the provided distance between the points
  dists[`${firstPointKey}-${lastPointKey}`] = distance;
  dists[`${lastPointKey}-${firstPointKey}`] = distance;
}

// Function to build the graph representation
function buildGraph(tracks) {
  const graph = {};
  const dists = {}; // To store distances between points

  // Build the initial graph with all points and their distances
  tracks.forEach(track => {
    for (let i = 1; i < track.length; i++) {
      const [p1, p2] = [track[i - 1], track[i]];
      const distance = distanceBetween(p1, p2);

      connectPoints(graph, dists, p1, p2, distance);
    }
  });

  return [graph, dists];
}

// Optionally link tracks' endpoints.  We can invoke this function like so:
// tracks.forEach(track => {
//   const excludePoints = new Set(track.map(getPointKey));
//   maybeLinkToGraph(graph, dists, track[0], excludePoints);
//   maybeLinkToGraph(graph, dists, track[track.length - 1], excludePoints);
// })
function maybeLinkToGraph(graph, dists, point, exclude) {
  const closestPoint = findNearestVertex(graph, point, exclude);
  const distance = distanceBetween(point, getCoordinates(closestPoint));
  if (distance < 0.05) {
    connectPoints(graph, dists, point, closestPoint, distance)
  }
}

function compressGraph(graph, distances, startVertex) {
  const compressedGraph = {};
  const compressedDistances = { ...distances };
  const expandedPaths = {}; // To store the paths after compression

  // Initialize compressed graph structure
  for (const key in graph) {
    compressedGraph[key] = new Set(graph[key]);
  }

  let changed = true;
  while (changed) {
    changed = false;

    for (const vertex in compressedGraph) {
      if (vertex !== startVertex && compressedGraph[vertex].size === 2) {
        const [neighbor1, neighbor2] = Array.from(compressedGraph[vertex]);

        // Check if both neighbors are degree-2 vertices or already compressed vertices
        if (compressedGraph[neighbor1].size === 2 && compressedGraph[neighbor2].size === 2 &&
          neighbor1 !== startVertex && neighbor2 !== startVertex
        ) {
          // Remove the vertex from the graph and add an edge between its neighbors
          compressedGraph[neighbor1].delete(vertex);
          compressedGraph[neighbor2].delete(vertex);
          compressedGraph[neighbor1].add(neighbor2);
          compressedGraph[neighbor2].add(neighbor1);

          // Calculate the new distance by summing distances along the collapsed path
          const newDistance = compressedDistances[`${neighbor1}-${vertex}`] + compressedDistances[`${vertex}-${neighbor2}`];
          compressedDistances[`${neighbor1}-${neighbor2}`] = newDistance;
          compressedDistances[`${neighbor2}-${neighbor1}`] = newDistance;

          // Initialize the paths or merge previous paths if they exist
          const path1 = expandedPaths[`${neighbor1}-${vertex}`] || [];
          const path2 = expandedPaths[`${vertex}-${neighbor2}`] || [];

          // Create the new expanded path between neighbor1 and neighbor2 (without duplicating the middle vertex)
          expandedPaths[`${neighbor1}-${neighbor2}`] = [...path1, vertex, ...path2];
          expandedPaths[`${neighbor2}-${neighbor1}`] = [...path2.reverse(), vertex, ...path1.reverse()];

          // Remove the vertex from the graph
          delete compressedGraph[vertex];

          // Remove the vertex from the distances object
          delete compressedDistances[`${neighbor1}-${vertex}`];
          delete compressedDistances[`${neighbor2}-${vertex}`];
          delete compressedDistances[`${vertex}-${neighbor1}`];
          delete compressedDistances[`${vertex}-${neighbor2}`];

          changed = true; // Continue processing
        }
      }
    }
  }

  console.log('Original graph: ', Object.keys(graph).length, 'keys.');
  console.log('Compressed: ', Object.keys(compressedGraph).length, 'keys.');
  console.log('Expanded paths:', expandedPaths);
  return [compressedGraph, compressedDistances, expandedPaths];
}

function uncompressRoute(compressedRoute, expandedPaths) {
  let fullRoute = [compressedRoute[0]];

  for (let i = 1; i < compressedRoute.length; i++) {
    const start = compressedRoute[i - 1];
    const end = compressedRoute[i];
    const key = `${start}-${end}`;

    if (expandedPaths[key]) {
      fullRoute = fullRoute.concat(expandedPaths[key].map(getCoordinates));
    }
    fullRoute.push(end);
  }

  return fullRoute;
}