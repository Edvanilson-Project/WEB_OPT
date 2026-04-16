export type Profile = {
  id?: string | number;
  avatar?: string;
  name?: string;
  time?: string;
};

export interface BlogType {
  id?: string;
  profile: Profile;
  time?: Date;
  comment?: string;
  replies?: BlogType[];
}

export interface BlogPostType {
  id: number | string;
  title: string;
  content?: string;
  coverImg?: string | any;
  createdAt?: Date;
  view?: number;
  share?: number;
  category?: string;
  featured?: boolean;
  author?: Profile;
  comments?: BlogType[];
  published: boolean;
}


// export type BlogPostType = {
//   id: string;
//   title: string;
//   content: string;
//   coverImg: string;
//   createdAt: string;
//   category: string;
//   published: boolean;
//   author: {
//     name: string;
//     avatar: string;
//   };