use crate::klarf::DefectRecord;
use rstar::{RTree, RTreeObject, AABB, PointDistance};
use std::collections::HashMap;

const UNCLASSIFIED: i32 = -1;
const NOISE: i32 = 0;

#[derive(Debug, Clone)]
pub struct ClusterBBox {
  pub min_x: f64,
  pub min_y: f64,
  pub max_x: f64,
  pub max_y: f64,
}

#[derive(Debug, Clone)]
pub struct ClusterInfo {
  pub cluster_id: i32,
  pub point_count: usize,
  pub bbox: ClusterBBox,
  pub is_scratch: bool,
  pub linearity: f64,
  pub angle_deg: f64,
}

pub struct SpatialClusterResult {
  pub defect_cluster_ids: Vec<i32>,
  pub clusters: Vec<ClusterInfo>,
}

#[derive(Clone)]
struct DefectPoint {
  x: f64,
  y: f64,
  index: usize,
}

impl RTreeObject for DefectPoint {
  type Envelope = AABB<[f64; 2]>;

  fn envelope(&self) -> Self::Envelope {
    AABB::from_corners([self.x, self.y], [self.x, self.y])
  }
}

impl PointDistance for DefectPoint {
  fn distance_2(&self, point: &[f64; 2]) -> f64 {
    let dx = self.x - point[0];
    let dy = self.y - point[1];
    dx * dx + dy * dy
  }
}

pub fn run_dbscan(
  defects: &[DefectRecord],
  eps: f64,
  min_points: usize,
) -> SpatialClusterResult {
  if defects.is_empty() {
    return SpatialClusterResult {
      defect_cluster_ids: Vec::new(),
      clusters: Vec::new(),
    };
  }

  let points: Vec<DefectPoint> = defects
    .iter()
    .enumerate()
    .map(|(i, d)| DefectPoint {
      x: d.x_rel,
      y: d.y_rel,
      index: i,
    })
    .collect();

  let rtree: RTree<DefectPoint> = RTree::bulk_load(points.clone());

  let n = defects.len();
  let mut cluster_ids = vec![UNCLASSIFIED; n];
  let mut current_cluster: i32 = 0;

  for point in &points {
    let idx = point.index;
    if cluster_ids[idx] != UNCLASSIFIED {
      continue;
    }

    let neighbors = find_neighbors(&rtree, point, eps);
    if neighbors.len() < min_points {
      cluster_ids[idx] = NOISE;
      continue;
    }

    current_cluster += 1;
    cluster_ids[idx] = current_cluster;

    let mut seed_set: Vec<usize> = neighbors.iter().map(|p| p.index).collect();
    let mut seed_idx = 0;

    while seed_idx < seed_set.len() {
      let q_idx = seed_set[seed_idx];
      seed_idx += 1;

      if cluster_ids[q_idx] == NOISE {
        cluster_ids[q_idx] = current_cluster;
      }

      if cluster_ids[q_idx] != UNCLASSIFIED {
        continue;
      }

      cluster_ids[q_idx] = current_cluster;

      let q_point = &points[q_idx];
      let q_neighbors = find_neighbors(&rtree, q_point, eps);

      if q_neighbors.len() >= min_points {
        for neighbor in q_neighbors {
          let n_idx = neighbor.index;
          if cluster_ids[n_idx] == UNCLASSIFIED || cluster_ids[n_idx] == NOISE {
            if cluster_ids[n_idx] == UNCLASSIFIED {
              seed_set.push(n_idx);
            }
            cluster_ids[n_idx] = current_cluster;
          }
        }
      }
    }
  }

  let cluster_map = build_cluster_bboxes(&points, &cluster_ids, current_cluster);

  let clusters: Vec<ClusterInfo> = cluster_map
    .into_iter()
    .map(|(cid, (count, bbox))| {
      let dx = bbox.max_x - bbox.min_x;
      let dy = bbox.max_y - bbox.min_y;
      let max_dim = dx.max(dy).max(1e-10);
      let min_dim = dx.min(dy).max(1e-10);
      let linearity = max_dim / min_dim;
      let angle_deg = dy.atan2(dx).to_degrees();
      let is_scratch = count >= 3 && linearity > 3.0;

      ClusterInfo {
        cluster_id: cid,
        point_count: count,
        bbox,
        is_scratch,
        linearity,
        angle_deg,
      }
    })
    .filter(|c| c.cluster_id > 0)
    .collect();

  SpatialClusterResult {
    defect_cluster_ids: cluster_ids,
    clusters,
  }
}

fn find_neighbors<'a>(rtree: &'a RTree<DefectPoint>, point: &DefectPoint, eps: f64) -> Vec<&'a DefectPoint> {
  let search_box = AABB::from_corners(
    [point.x - eps, point.y - eps],
    [point.x + eps, point.y + eps],
  );

  rtree
    .locate_in_envelope_intersecting(&search_box)
    .filter(|p| {
      let dx = p.x - point.x;
      let dy = p.y - point.y;
      (dx * dx + dy * dy) <= eps * eps
    })
    .collect()
}

fn build_cluster_bboxes(
  points: &[DefectPoint],
  cluster_ids: &[i32],
  _max_cluster: i32,
) -> HashMap<i32, (usize, ClusterBBox)> {
  let mut map: HashMap<i32, (usize, ClusterBBox)> = HashMap::new();

  for (i, &cid) in cluster_ids.iter().enumerate() {
    if cid <= 0 {
      continue;
    }

    let p = &points[i];
    let entry = map.entry(cid).or_insert_with(|| {
      (
        0,
        ClusterBBox {
          min_x: p.x,
          min_y: p.y,
          max_x: p.x,
          max_y: p.y,
        },
      )
    });

    entry.0 += 1;
    entry.1.min_x = entry.1.min_x.min(p.x);
    entry.1.min_y = entry.1.min_y.min(p.y);
    entry.1.max_x = entry.1.max_x.max(p.x);
    entry.1.max_y = entry.1.max_y.max(p.y);
  }

  map
}
