import { MainConfig } from "../shared/Config"
import { MainApp } from "./MainApp"

export interface MainEnvironment {
	config: MainConfig
	app: MainApp
}
