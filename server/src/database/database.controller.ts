import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Put,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { Policy, Proxy } from 'database-proxy/dist'
import { ApplicationAuthGuard } from 'src/authentication/application.auth.guard'
import { JwtAuthGuard } from 'src/authentication/jwt.auth.guard'
import { IRequest, IResponse } from 'src/utils/interface'
import { DedicatedDatabaseService } from './dedicated-database/dedicated-database.service'
import { FileInterceptor } from '@nestjs/platform-express'
import { ImportDatabaseDto } from './dto/import-database.dto'
import { InjectUser } from 'src/utils/decorator'
import { UserWithKubeconfig } from 'src/user/entities/user'
import { ResponseUtil } from 'src/utils/response'
import path from 'path'
import * as os from 'os'
import { createReadStream, existsSync, mkdirSync } from 'fs'
import { unlink, writeFile } from 'fs/promises'

@ApiTags('Database')
@ApiBearerAuth('Authorization')
@Controller('apps/:appid/databases')
export class DatabaseController {
  private readonly logger = new Logger(DatabaseController.name)

  constructor(
    private readonly dedicatedDatabaseService: DedicatedDatabaseService,
  ) {}

  /**
   * The database proxy for database management
   * @param appid
   * @param req
   */
  @ApiOperation({ summary: 'The database proxy for database management' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Post('proxy')
  async proxy(@Param('appid') appid: string, @Req() req: IRequest) {
    const accessor = await this.dedicatedDatabaseService.getDatabaseAccessor(
      appid,
    )

    // Don't need policy rules, open all collections' access permission for dbm use.
    // Just create a empty policy for proxy.
    const proxy = new Proxy(accessor, new Policy(accessor))

    // parse params
    const params = proxy.parseParams(req.body)

    // execute query
    try {
      const data = await proxy.execute(params)
      await accessor.close()

      // this response struct just for database proxy
      return {
        code: 0,
        data,
      }
    } catch (error) {
      await accessor.close()
      if (error.code === 121) {
        const errs = error.errInfo?.details?.schemaRulesNotSatisfied
        return {
          code: error.code,
          error: errs,
        }
      }
      return {
        code: error.code || 1,
        error: error,
      }
    }
  }

  @ApiOperation({ summary: 'Export database of an application' })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Get('export')
  async exportDatabase(
    @Param('appid') appid: string,
    @Res({ passthrough: true }) res: IResponse,
    @InjectUser() user: UserWithKubeconfig,
  ) {
    const databaseSyncLimit =
      await this.dedicatedDatabaseService.checkDatabaseSyncLimit(user._id)
    if (databaseSyncLimit) {
      return ResponseUtil.error('database sync limit exceeded')
    }
    const tempFilePath = path.join(
      os.tmpdir(),
      'mongodb-data',
      'export',
      `${appid}-db.gz`,
    )

    // check if dir exists
    if (!existsSync(path.dirname(tempFilePath))) {
      mkdirSync(path.dirname(tempFilePath), { recursive: true })
    }

    await this.dedicatedDatabaseService.exportDatabase(
      appid,
      tempFilePath,
      user,
    )
    const filename = path.basename(tempFilePath)

    res.set({
      'Content-Disposition': `attachment; filename="${filename}"`,
    })
    const file = createReadStream(tempFilePath)
    return new StreamableFile(file)
  }

  @ApiOperation({ summary: 'Import database of an application' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: ImportDatabaseDto,
  })
  @UseGuards(JwtAuthGuard, ApplicationAuthGuard)
  @Put('import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 3 * 1024 * 1024 * 1024, // 3 GB
      },
    }),
  )
  async importDatabase(
    @UploadedFile() file: Express.Multer.File,
    @Body('sourceAppid') sourceAppid: string,
    @Param('appid') appid: string,
    @InjectUser() user: UserWithKubeconfig,
  ) {
    const databaseSyncLimit =
      await this.dedicatedDatabaseService.checkDatabaseSyncLimit(user._id)
    if (databaseSyncLimit) {
      return ResponseUtil.error('database sync limit exceeded')
    }
    // check if db is valid
    if (!/^[\-a-z0-9]{6,20}$/.test(sourceAppid)) {
      return ResponseUtil.error('Invalid source appid')
    }
    // check if file is .gz
    if (file.mimetype !== 'application/gzip') {
      return ResponseUtil.error('Invalid db file')
    }

    const tempFilePath = path.join(
      os.tmpdir(),
      'mongodb-data',
      'import',
      `${appid}-${sourceAppid}.gz`,
    )

    // check if dir exists
    if (!existsSync(path.dirname(tempFilePath))) {
      mkdirSync(path.dirname(tempFilePath), { recursive: true })
    }

    try {
      await writeFile(tempFilePath, file.buffer)
      await this.dedicatedDatabaseService.importDatabase(
        appid,
        sourceAppid,
        tempFilePath,
        user,
      )
      return ResponseUtil.ok({})
    } finally {
      if (existsSync(tempFilePath)) await unlink(tempFilePath)
    }
  }
}
